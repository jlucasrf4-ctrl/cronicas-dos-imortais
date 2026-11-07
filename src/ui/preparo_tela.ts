/* ==== v7.7 — tela de preparação repaginada (esboço "versão 1" aprovado pelo mantenedor em 2026-10-18) ====
   O HTML do #prep-modal continua o da v7.6 (montagem.test.ts); montarPreparo() o reorganiza uma vez, ao carregar:
   - barra de título escura com o botão de fechar;
   - encaixes do corpo à esquerda, a silhueta do herói no meio (h.sexo: "M" masculina; sem ele, feminina) no lugar do retrato
     3D, armas à direita e, ao lado delas, a mochila e a aljava (#prep-lado, onde prepAltRender põe #prep-mochila);
   - as compras de última hora e a mensagem descem para a coluna da mochila;
   - no rodapé, o Baú no lugar da Forja: fecha o preparo, abre o baú com o herói escolhido e, ao fechar o baú, volta
     ao preparo (prepVoltarDoBau, chamado por closeChest). Na tenda do acampamento o botão some (lá o baú é o do campo).
   Visual: src/styles/45_v7.7_preparo_tela.css. */
import { dungeon } from "../core/state.ts";
import { prep } from "../econ/economia.ts";
import { fillHeroSelect, renderChest } from "../econ/bau.ts";
import { closePrep, openPrep, prepHero, renderPrep } from "../expedicao/preparo.ts";
import { icoTag } from "./icones.ts";
import { silhuetaDe } from "./contornos.ts";
import { glRetratoEquipado } from "../render/retrato.ts";
import { INV, ensureInv } from "../items/inventario.ts";
import { ensureEquip, unequip } from "../items/equipamento.ts";
import { gradesDasBolsas, soltarDoCinto } from "../items/cinto.ts";
import { bolsasNaTela, faixaCintoHtml } from "./cinto_tela.ts";
import type { GradeTela, Hero } from "../core/tipos.ts";

/** O herói cujo preparo foi fechado para abrir o baú (volta para ele quando o baú fechar). */
const PREP_BAU = { volta: null as string | null };

export function montarPreparo() {
  const card = document.querySelector<HTMLElement>("#prep-modal .v3-card");
  if (!card || card.classList.contains("prep77")) return;
  card.classList.add("prep77");
  card.style.width = "";
  // título
  const h2 = card.querySelector("h2")!;
  h2.innerHTML = '<span class="p77-bussola">✦</span>Preparação da expedição';
  const x = document.createElement("button");
  x.className = "p77-x";
  x.title = "Fechar";
  x.textContent = "✕";
  x.addEventListener("click", () => document.getElementById("prep-cancel")!.click());
  h2.appendChild(x);
  // silhueta no lugar do retrato (os canvas ficam, escondidos: o código antigo ainda os procura)
  const fig = document.createElement("div");
  fig.className = "p77-fig";
  fig.innerHTML =
    '<canvas id="prep-silhueta" width="240" height="480" aria-label="Prévia do personagem equipado"></canvas>';
  document.getElementById("prep-portrait")!.before(fig);
  // fora do .eq-wrap: ele tem o próprio ouvinte de clique, e o #prep-mochila também (o clique contaria duas vezes)
  const wrap = card.querySelector(".eq-wrap")!,
    corpo = document.createElement("div"),
    lado = document.createElement("div");
  corpo.className = "p77-corpo";
  lado.id = "prep-lado";
  wrap.before(corpo);
  corpo.append(wrap, lado);
  // faixa do cinto (o #prep-alt da Arma 2 entra entre o corpo e ela: prepAltRender o põe logo depois do corpo)
  const cinto = document.createElement("div");
  cinto.id = "prep-cinto";
  corpo.after(cinto);
  cinto.addEventListener("click", cintoClique);
  // compras e mensagem na coluna da mochila
  const shop = document.getElementById("prep-shop")!,
    titulo = shop.previousElementSibling,
    bags = card.querySelector(".prep-bags")!;
  // grades das bolsas do cinto, depois da aljava
  const bolsas = document.createElement("div");
  bolsas.id = "prep-bolsas";
  bags.appendChild(bolsas);
  if (titulo && titulo.tagName === "H3") bags.appendChild(titulo);
  bags.append(shop, document.getElementById("prep-msg")!);
  // rodapé: Baú antes da Ficha
  const ficha = document.getElementById("prep-sheet")!;
  ficha.parentElement!.classList.add("p77-rodape");
  const bau = document.createElement("button");
  bau.className = "btn";
  bau.id = "prep-bau";
  bau.innerHTML = icoTag("ui_bau", "📦") + " Baú";
  bau.title = "Abre o baú com este personagem (fechar o baú volta para cá)";
  bau.addEventListener("click", prepAbrirBau);
  ficha.before(bau);
}

/** A cada renderPrep: a silhueta do herói e o botão do Baú (só fora da tenda). */
export function prepTela(h: Hero) {
  const canvas = document.getElementById("prep-silhueta") as HTMLCanvasElement | null;
  if (canvas) {
    canvas.style.background = `center / contain no-repeat url("${silhuetaDe(h)}")`;
    ensureEquip(h);
    glRetratoEquipado(h, canvas);
  }
  const bau = document.getElementById("prep-bau");
  if (bau) bau.style.display = dungeon.active ? "none" : "";
  renderCinto(h);
}

/* ---- cinto: a faixa e as grades das bolsas (ui/cinto_tela.ts, a mesma da mochila do campo) ---- */
function renderCinto(h: Hero) {
  const box = document.getElementById("prep-cinto");
  if (box) box.innerHTML = faixaCintoHtml(h, "eq-slot");
}
function cintoClique(ev: MouseEvent) {
  const t = ev.target as HTMLElement,
    h = prep.open ? prepHero() : null;
  if (!h) return;
  const enc = t.closest<HTMLElement>("[data-slot=cinto]"),
    pr = t.closest<HTMLElement>("[data-presilha]");
  let msg: string;
  if (enc) msg = unequip(h, "cinto", ensureInv(h));
  else if (pr) msg = soltarDoCinto(h, +pr.dataset.presilha!, ensureInv(h));
  else return;
  ev.stopPropagation();
  if (msg) document.getElementById("prep-msg")!.textContent = msg;
  renderPrep();
}
/** As grades das bolsas presas no cinto, para INV.invGrids (prepGrids em expedicao/preparo.ts). */
export function prepGradesBolsas(h: Hero): GradeTela[] {
  return bolsasNaTela(h, document.getElementById("prep-bolsas"));
}
/** As bolsas mudaram (prendeu, soltou, trocou o cinto)? Então a lista de grades do preparo precisa ser refeita. */
export function prepBolsasMudaram(h: Hero) {
  const gs = gradesDasBolsas(h),
    atuais = INV.invGrids.filter((g) => g.inv.bolsa).map((g) => g.inv);
  return gs.length !== atuais.length || gs.some((g, i) => g !== atuais[i]);
}

function prepAbrirBau() {
  const id = prep.heroId;
  if (!id || dungeon.active) return;
  closePrep();
  PREP_BAU.volta = id;
  INV.chestOpen = true;
  fillHeroSelect("chest-hero", id);
  document.getElementById("chest-modal")!.classList.add("open");
  renderChest();
}

/** Chamado ao fechar o baú: se ele foi aberto pelo preparo, volta para o preparo do mesmo herói. */
export function prepVoltarDoBau() {
  const id = PREP_BAU.volta;
  PREP_BAU.volta = null;
  if (id && !dungeon.active) openPrep(id);
}
