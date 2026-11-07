/* ==== v7.7 — campanha: estado no save, missões que avançam por evento, falas da tabela e o objetivo na tela ====
   O roteiro (missões, falas) está em data/campanha.ts. O jogo avisa o que aconteceu com campanhaEvento("<evento>");
   a missão cujo `conclui` bate termina e a próxima começa. O estado fica em econ.campanha (vai no save). Um save de
   antes da campanha ganha a etapa certa pelas marcas que já existiam (introDone, campTut). O objetivo atual aparece
   no quadro #missao (canto de cima à direita, no mapa e no campo), atualizado por iniciarCampanha.
   v8.0: além da corrente principal (`etapa`) há a linha paralela dos lobos (`paralela`): os eventos e os chamados do
   Caçador valem para as duas, e o quadro mostra a paralela numa linha menor embaixo. */
import { dungeon, econ, world } from "../core/state.ts";
import { ATOS, FALANTES, FALAS, LINHAS, MISSAO_INICIAL, MISSOES } from "../data/campanha.ts";
import type { Missao } from "../data/campanha.ts";
import type { EstadoCampanha } from "../core/tipos.ts";
import { ISC, say, introUi } from "../intro/cena.ts";
import { mvToast } from "../ui/avisos.ts";
import { forgeLearn } from "../forja/forja.ts";
import {
  anunciarPedido,
  entregarPedido,
  pedidoAtual,
  pedidoConferir,
  pedidoEntregavel,
  pedidoNovo,
} from "./pedidos.ts";
import type { PaginaFala } from "../intro/cena.ts";
import { pushEvent } from "../sim/eventos.ts";
import { sfx } from "../field/chao.ts";
import { esc } from "../core/util.ts";
import { musgoCity } from "../map/vila_musgo.ts";
import { vilaTick } from "../map/vila.ts";
import { itemSell } from "../items/qualidade.ts";

/** Quanto tempo (ms) o quadro do objetivo fica destacado quando a missão muda. */
const MISSAO_T = { novo: 4000 };
const MISSAO_UI = { oculta: false };

/** Etapa de um save que não tinha campanha, pelas marcas antigas. */
function etapaDeSaveAntigo() {
  if (econ.campTut === 3) return "a2_livre";
  if (econ.campTut === 2) return "a1_noite";
  if (econ.introDone) return "a1_acampamento";
  return MISSAO_INICIAL;
}

/** A primeira missão ainda não feita da corrente que começa em `id` (null = todas feitas). */
function primeiraNaoFeita(C: EstadoCampanha, id: string | null) {
  for (let n = 0; id && MISSOES[id] && n < 200; id = MISSOES[id].proxima, n++) if (C.feitas[id] == null) return id;
  return null;
}
/** v8.0 — save de antes da linha paralela dos lobos (passou do cercado): a linha abre na primeira missão de lobo não
    feita; se a corrente estava numa missão de lobo, ela volta para a primeira principal não feita depois do cercado. */
function migrarParalela(C: EstadoCampanha) {
  const cercado = MISSOES.a3_cercado;
  if (C.paralela !== undefined || C.feitas.a3_cercado == null || !cercado.abre) return;
  C.paralela = primeiraNaoFeita(C, cercado.abre);
  const E = C.etapa ? MISSOES[C.etapa] : null;
  if (E && E.linha) C.etapa = primeiraNaoFeita(C, cercado.proxima);
}

/** O estado da campanha (cria na primeira leitura). */
export function campanha(): EstadoCampanha {
  const C = (econ.campanha ||= { etapa: etapaDeSaveAntigo(), feitas: {}, flags: {} });
  migrarParalela(C);
  return C;
}
export function missaoAtual(): Missao | null {
  const e = campanha().etapa;
  return e ? MISSOES[e] || null : null;
}
/** v8.0 — a missão da linha paralela (os lobos), ou null. */
export function missaoParalela(): Missao | null {
  const e = campanha().paralela;
  return e ? MISSOES[e] || null : null;
}

const VISTO = { etapa: undefined as string | null | undefined, desde: 0 };

/** A missão mudou: redesenha o quadro já (sem página, nos testes em Node, não faz nada). */
function mudou(som: boolean) {
  try {
    if (som) sfx("perfect");
    desenharMissao();
  } catch (_) {}
}

/** Começa a missão `id` (null = fim do conteúdo pronto) na corrente dela (principal ou paralela). Não marca nada como
    feito. */
export function campanhaIr(id: string | null) {
  if (id !== null && !MISSOES[id]) return false;
  if (id && MISSOES[id].linha) campanha().paralela = id;
  else campanha().etapa = id;
  mudou(false);
  return true;
}

function novaMissao(P: Missao | null) {
  if (!P) return;
  pushEvent("📜 " + (P.linha ? LINHAS[P.linha] + ": " : "Nova missão: ") + P.titulo + " — " + P.objetivo);
  if (P.chamado) avisarChamado();
}
function concluir(id: string) {
  const C = campanha();
  C.feitas[id] = world.tick || 0;
  const M = MISSOES[id];
  if (M.linha) C.paralela = M.proxima;
  else C.etapa = M.proxima;
  novaMissao(M.proxima ? MISSOES[M.proxima] : null);
  // v8.0: abre a linha paralela (uma vez só)
  if (M.abre && C.paralela === undefined) {
    C.paralela = M.abre;
    novaMissao(MISSOES[M.abre]);
  }
}

/* ---------- v7.7 — o Caçador chama (missão com `chamado`) ---------- */
/** A missão cuja fala o Caçador quer dizer: a principal primeiro, depois a da linha paralela. */
function missaoChamando() {
  const M = missaoAtual(),
    L = missaoParalela();
  return M && M.chamado ? M : L && L.chamado ? L : null;
}
/** O que o Caçador quer dizer agora: a fala de uma missão (`chamado`), "pedido" (um pedido de carne novo,
    campanha/pedidos.ts) ou null. */
export function chamadoAtual() {
  const M = missaoChamando();
  if (M) return M.chamado!;
  return pedidoNovo() ? "pedido" : null;
}
function avisarChamado() {
  try {
    if (dungeon.active && dungeon.camp) return; // no acampamento o "❗" sobre ele já basta
    mvToast("❗ O Caçador quer falar com você · volte ao acampamento");
  } catch (_) {}
}
/** Falar com o Caçador quando ele chama (a fala da missão, que a conclui; ou o pedido de carne novo) ou quando dá
    para entregar o pedido. Devolve se ele falou. */
export function atenderChamado() {
  const M = missaoChamando(),
    id = chamadoAtual(),
    entregar = !id && pedidoEntregavel();
  if (!id && !entregar) return false;
  econ.hunterNap = false; // chamou = está acordado
  try {
    introUi();
    document.getElementById("isc-cine")!.classList.remove("on");
  } catch (_) {}
  if (entregar) entregarPedido(() => campanhaEvento("pedidoEntregue"));
  else if (id === "pedido") anunciarPedido(() => campanhaEvento("pedidoAnunciado"));
  else
    falar(id!, () => {
      if (M!.aprende) forgeLearn(M!.aprende); // v7.7: o Caçador ensina uma receita (a armadura de couro)
      if (M!.marca) campanha().flags[M!.marca] = true; // v8.0: ex. o bote furado (map/vila_musgo.ts)
      campanhaEvento(M!.conclui);
    });
  return true;
}
/** Os pedidos de carne começam depois que o jogador alimenta o lobo pela primeira vez (iniciarCampanha chama). */
export function pedidosTick() {
  const C = campanha();
  avisoBau();
  vilaTick(); // v8.0: o conserto do bote (map/vila.ts)
  if (C.feitas.a3_alimentar == null) return;
  if (pedidoConferir(C.feitas.a3_pedido == null)) avisarChamado();
}

/** v8.0 — o baú passou de AVISO_BAU de valor (preço da Vila Musgo) antes do Ato 4: um aviso (uma vez) de que dá para
    vender na vila. Não mexe na corrente: a missão de vender vem depois do Ato 3. */
const AVISO_BAU = 100;
function avisoBau() {
  const C = campanha(),
    M = missaoAtual();
  if (C.flags.avisoBau || !M || M.ato >= 4 || !econ.stash) return;
  const c = musgoCity();
  if (!c) return;
  let v = 0;
  for (const it of econ.stash.items) v += itemSell(c, it);
  if (v < AVISO_BAU) return;
  C.flags.avisoBau = true;
  mvToast("💰 O baú já vale " + Math.floor(v) + " de ouro · dá para vender na Vila Musgo (a pé)");
  pushEvent("💰 O baú do acampamento já vale " + Math.floor(v) + " de ouro. Peles e carne vendem bem na Vila Musgo.");
}
/** Conclui a missão `inicio` ou uma mais adiante na corrente dela que tenha o evento (as do meio contam). */
function avancar(inicio: string | null | undefined, ev: string) {
  const corrente: string[] = [];
  for (let id = inicio, n = 0; id && MISSOES[id] && n < 200; id = MISSOES[id].proxima, n++) {
    corrente.push(id);
    if (MISSOES[id].conclui !== ev) continue;
    for (const k of corrente) concluir(k);
    return true;
  }
  return false;
}
/** O jogo avisa que algo aconteceu. Avança a corrente principal e, se o evento não era dela, a linha paralela. */
export function campanhaEvento(ev: string) {
  if (!ev) return false;
  const ok = avancar(campanha().etapa, ev) || avancar(campanha().paralela, ev);
  if (ok) mudou(true);
  return ok;
}

/** v7.7 — como campanhaEvento, mas só se for o evento da missão atual (de uma das duas correntes): para o que pode
    acontecer fora de hora (forjar uma peça que se aprendeu por um projeto não pula a corrente). */
export function campanhaEventoAtual(ev: string) {
  const M = missaoAtual(),
    L = missaoParalela();
  return ((!!M && M.conclui === ev) || (!!L && L.conclui === ev)) && campanhaEvento(ev);
}

/** Conclui a missão atual sem o evento (gameshark). */
export function campanhaPular() {
  const id = campanha().etapa;
  if (!id || !MISSOES[id]) return null;
  concluir(id);
  mudou(false);
  return campanha().etapa;
}

/** Diz uma fala da tabela FALAS na caixa de diálogo do campo. `acoes[i]` roda quando a página i aparece. */
export function falar(id: string, done: () => void, acoes?: Record<number, () => void>) {
  const F = FALAS[id];
  if (!F) {
    done();
    return;
  }
  const pages: PaginaFala[] = F.paginas.map((linhas, i) => {
    const p: PaginaFala = { ...linhas };
    if (acoes && acoes[i]) p.act = acoes[i];
    return p;
  });
  say(pages, done, FALANTES[F.quem]);
}

/* ---------- o quadro do objetivo ---------- */
function visivel() {
  if (!world.heroes.length) return false;
  const tit = document.getElementById("title-screen");
  if (tit && tit.classList.contains("open")) return false;
  if (dungeon.active && (dungeon.mode === "intro" || dungeon.modalOpen || dungeon.invOpen)) return false;
  if (ISC.dlg) return false;
  const obj = document.getElementById("isc-obj");
  if (obj && obj.classList.contains("on")) return false; // a cena já mostra o objetivo dela
  const app = document.getElementById("app");
  if (!dungeon.active && app && app.classList.contains("hud-off")) return false;
  return true;
}
function quadro() {
  let el = document.getElementById("missao");
  if (!el) {
    el = document.createElement("div");
    el.id = "missao";
    document.body.appendChild(el);
  }
  let abrir = document.getElementById("missao-abrir");
  if (!abrir) {
    abrir = document.createElement("button");
    abrir.id = "missao-abrir";
    abrir.className = "btn";
    abrir.setAttribute("type", "button");
    abrir.title = "Abrir missões";
    abrir.setAttribute("aria-label", "Abrir missões");
    abrir.textContent = "📜";
    document.body.appendChild(abrir);
  }
  return el;
}
/** Atualiza o quadro do objetivo (iniciarCampanha chama de tempos em tempos; quem muda a missão chama na hora). */
export function desenharMissao() {
  const el = quadro();
  if (!visivel()) {
    el.classList.remove("on");
    document.getElementById("missao-abrir")?.classList.remove("on");
    return;
  }
  const M = missaoAtual(),
    L = missaoParalela(),
    C = campanha(),
    etapa = C.etapa + "|" + C.paralela,
    agora = performance.now();
  if (VISTO.etapa !== etapa) {
    if (VISTO.etapa !== undefined) VISTO.desde = agora;
    VISTO.etapa = etapa;
  }
  if (!M && !L) {
    el.classList.remove("on");
    document.getElementById("missao-abrir")?.classList.remove("on");
    return;
  }
  // v7.7: com um pedido de carne em aberto, ele no lugar do objetivo (na linha que tem `pedido`)
  const objetivo = (X: Missao) => esc((X.pedido && pedidoAtual()) || X.objetivo);
  let html = M
    ? "<small>Ato " +
      M.ato +
      " · " +
      esc(ATOS[M.ato] || "") +
      "</small><b>" +
      esc(M.titulo) +
      "</b><span>" +
      objetivo(M) +
      "</span>"
    : "";
  // v8.0: a linha paralela (os lobos), menor, embaixo
  if (L) html += "<em><small>🐺 " + esc(LINHAS[L.linha!] || L.titulo) + "</small>" + objetivo(L) + "</em>";
  html =
    '<button id="missao-fechar" type="button" aria-label="Fechar objetivo" title="Fechar objetivo">×</button>' + html;
  if (el._h !== html) {
    el._h = html;
    el.innerHTML = html;
  }
  /* no campo fica à direita, logo abaixo do HUD; no mapa, no meio, logo acima da barra de recursos (as duas mudam
     de altura); no celular o CSS põe embaixo, à direita */
  const campo = dungeon.active;
  el.classList.toggle("campo", campo);
  const mob = document.documentElement.classList.contains("mob"),
    // v7.7: no campo, no alto da cena (a barra do HUD agora fica embaixo, centralizada)
    palco = !mob && campo ? document.getElementById("dungeon-stage-wrap") : null,
    barra = !mob && !campo ? document.getElementById("econ-bar") : null,
    rb = barra ? barra.getBoundingClientRect() : null,
    top = palco ? palco.getBoundingClientRect().top + 22 + "px" : "",
    bottom = rb && rb.height ? innerHeight - rb.top + 14 + "px" : "";
  if (el.style.top !== top) el.style.top = top;
  if (el.style.bottom !== bottom) el.style.bottom = bottom;
  el.classList.add("on");
  el.classList.toggle("oculta", MISSAO_UI.oculta);
  document.getElementById("missao-abrir")?.classList.toggle("on", MISSAO_UI.oculta);
  el.classList.toggle("novo", agora - VISTO.desde < MISSAO_T.novo);
}
export function ocultarMissao(oculta: boolean) {
  MISSAO_UI.oculta = oculta;
  document.getElementById("missao")?.classList.toggle("oculta", oculta);
  document.getElementById("missao-abrir")?.classList.toggle("on", oculta);
}
