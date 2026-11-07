/* ==== Fase 4 — baú do acampamento (base/05) ==== */
import { ehMochila } from "../items/mochilas.ts";
import { abrirMochilaGuardada } from "../ui/recipientes.ts";
import { world, econ, dungeon, GL3 } from "../core/state.ts";
import { INV, ensureInv } from "../items/inventario.ts";
import { renderInv, groundTake } from "../field/chao.ts";
import { moveItem, updateEcon, prep, bag } from "./economia.ts";
import { EQ_SLOTS, EQ_BASE } from "../data/equipamento.ts";
import { icoTag, icoItem } from "../ui/icones.ts";
import { isArrowIt } from "../items/aljava.ts";
import { CAMP_SEND } from "../data/economia.ts";
import { eqName } from "../items/durabilidade.ts";
import { qvItemTo, invMenuPacotes } from "../ui/inventario.ts";
import { prepHero, renderPrep } from "../expedicao/preparo.ts";
import { itemMsg, inspectStone, spawnDungeonToast } from "../field/masmorra.ts";
import { eatItem, valorComida } from "../survival/sobrevivencia.ts";
import { forgeStudy, forgeDismantle } from "../forja/forja.ts";
import { equipItem } from "../items/equipamento.ts";
import { afHtml } from "../hero/atributos.ts";
import { invMenuGalho } from "../items/galho.ts";
import { mvToast } from "../ui/avisos.ts";
import { pushEvent } from "../sim/eventos.ts";
import { selAdicionar } from "../items/selecao_inv.ts";
import { prepVoltarDoBau } from "../ui/preparo_tela.ts";
import { opcaoDarAoLobo, darAoLobo } from "../campanha/cercado.ts";
import type { GradeTela, Item } from "../core/tipos.ts";

/* ---- baú: reaproveita renderInv/arrastar/girar da mochila ---- */
function idleHeroes() {
  return world.heroes.filter((h) => h.state === "idle");
}
export function fillHeroSelect(id: string, pick?: string) {
  const sel = document.getElementById(id) as HTMLInputElement,
    prev = pick || sel.value;
  sel.innerHTML = "";
  for (const h of idleHeroes()) {
    const o = document.createElement("option");
    o.value = h.id;
    o.textContent = h.name;
    sel.appendChild(o);
  }
  if (prev && idleHeroes().some((h) => h.id === prev)) sel.value = prev;
}
export function renderChest() {
  fillHeroSelect("chest-hero");
  const h = world.heroes.find((x) => x.id === (document.getElementById("chest-hero") as HTMLInputElement).value);
  INV.invGrids = [{ el: document.getElementById("chest-grid")!, inv: econ.stash }];
  const pk = document.getElementById("pack-grid")!;
  if (h) INV.invGrids.push({ el: pk, inv: ensureInv(h) });
  else {
    pk.innerHTML = "";
    pk.style.width = "0";
    pk.style.height = "0";
  }
  renderInv();
}

export function chestMoveAll(toPack: boolean) {
  const h = world.heroes.find((x) => x.id === (document.getElementById("chest-hero") as HTMLInputElement).value),
    msg = document.getElementById("chest-msg")!;
  if (!h) {
    msg.textContent = "Escolha um personagem que esteja no acampamento.";
    return;
  }
  const from = toPack ? econ.stash : ensureInv(h),
    to = toPack ? ensureInv(h) : econ.stash,
    cells = (it: Item) => it.shape.reduce((a, r) => a + r.filter(Boolean).length, 0);
  let moved = 0,
    left = 0;
  for (const it of from.items.slice().sort((a, b) => cells(b) - cells(a))) {
    if (it.def.res) {
      for (const t of to.items)
        if (t.def.key === it.def.key && (t.n || 1) < t.def.stack! && (it.n || 1) > 0) {
          const q = Math.min(t.def.stack! - (t.n || 1), it.n || 1);
          t.n = (t.n || 1) + q;
          it.n = (it.n || 1) - q;
        }
      if ((it.n || 1) <= 0) {
        from.items.splice(from.items.indexOf(it), 1);
        moved++;
        continue;
      }
    }
    if (moveItem(it, from, to)) moved++;
    else left++;
  }
  msg.textContent = moved + " item(ns) movido(s)" + (left ? " · " + left + " não couberam" : "") + ".";
  renderChest();
  updateEcon();
}
export function invItemMenu(it: Item, gr: GradeTela, x: number, y: number) {
  let m = document.getElementById("inv-menu");
  if (m) m.remove();
  const acts = [];
  if (it.def.slot && (prep.open || (dungeon.active && dungeon.invOpen)))
    acts.push([
      "equip",
      // v7.7: a mochila tem encaixe próprio (fora de EQ_SLOTS)
      "🧥 Equipar (" +
        (it.def.slot === "mochila" || it.def.slot === "aljava" || it.def.slot === "cinto"
          ? it.def.name
          : EQ_SLOTS.find((q) => q.id === it.def.slot)!.label) +
        ")",
    ]);
  // v7.7 — mochila guardada: abrir mostra o que tem dentro numa janela (ui/recipientes.ts)
  if (ehMochila(it) && dungeon.active && dungeon.invOpen)
    acts.push(["abrir", "🎒 Abrir (" + (it.conteudo ? it.conteudo.items.length : 0) + " itens)"]);
  if (it.def.blueprint) acts.push(["study", icoTag("ui_estudar", "📖") + " Estudar o projeto (aprende a receita)"]);
  if (it.def.slot && EQ_BASE[it.def.key] && EQ_BASE[it.def.key].forja !== false)
    acts.push(["dism", icoTag("ui_reparar", "🔧") + " Desmontar e aprender a receita"]);
  if (it.def.key === "pedra" && (it.insp || 0) < (it.n || 1))
    acts.push(["insp", icoTag("ui_inspecionar", "🔍") + " Inspecionar pedra (pode ser minério)"]);
  // v7.7 — a mochila aberta pelo menu do lobo (campanha/cercado.ts): dar esta comida a ele
  const lobo = opcaoDarAoLobo(it);
  if (lobo) acts.push(["lobo", lobo]);
  const comida = valorComida(it);
  if (comida)
    acts.push([
      "eat",
      "🍖 Comer" +
        (comida.raw
          ? " crua (pode dar enjoo)"
          : " (fome −" + comida.hunger + ", ferimento −" + comida.wound + ", vida +" + comida.hp + ")"),
    ]);
  if (gr.inv.qv && !isArrowIt(it)) {
    acts.push(["qvbag", "🎒 Mover para a mochila"]);
    if (dungeon.active && dungeon.invOpen) acts.push(["qvgnd", "🟫 Largar no chão"]);
  }
  if (CAMP_SEND[it.def.key]) {
    const g = CAMP_SEND[it.def.key](it);
    acts.push([
      "send",
      icoTag("ui_acampamento", "⛺") +
        " Enviar ao acampamento (" +
        (g.wood ? "+" + g.wood + " 🔥 lenha" : "+" + g.meat + " 🥩 comida") +
        ")",
    ]);
  }
  // v7.7 — seleção de vários itens (items/selecao_inv.ts)
  if (gr.inv.items.includes(it)) {
    const iguais = gr.inv.items.filter((o) => o.def.key === it.def.key).length;
    acts.push(["sel", "☑ Selecionar (marque outros com um toque)"]);
    if (iguais > 1) acts.push(["selTodos", "☑ Selecionar todos: " + it.def.name + " (" + iguais + ")"]);
  }
  if (acts.length || it.def.desc) {
    m = document.createElement("div");
    m.id = "inv-menu";
    m.style.cssText =
      "position:fixed;z-index:300;left:" +
      Math.min(innerWidth - 300, x + 8) +
      "px;top:" +
      Math.min(innerHeight - 160, y + 8) +
      "px;background:#2b2113;border:1px solid #e0b35f;border-radius:8px;padding:6px;display:flex;flex-direction:column;gap:4px;box-shadow:0 8px 22px rgba(0,0,0,.6);max-width:290px";
    m.innerHTML =
      '<b style="font-size:.74rem;color:#f0d9a2">' +
      icoItem(it.def) +
      " " +
      eqName(it) +
      (it.durMax ? " · " + it.dur + "/" + it.durMax : "") +
      (it.n! > 1 ? " ×" + it.n : "") +
      "</b>" +
      afHtml(it) +
      (it.def.desc ? '<i style="font-size:.68rem;color:#c9b88a">' + it.def.desc + "</i>" : "") +
      acts.map((a) => '<button class="btn" data-a="' + a[0] + '">' + a[1] + "</button>").join("") +
      '<button class="btn" data-a="x">Cancelar</button>';
    document.body.appendChild(m);
    m.addEventListener("click", (ev) => {
      const b = (ev.target as HTMLElement).closest("button");
      if (!b) return;
      const a = b.dataset.a;
      if (a === "send") sendToCamp(it, gr);
      else if (a === "lobo") darAoLobo(it, gr.inv);
      else if (a === "sel") selAdicionar([it]);
      else if (a === "selTodos") selAdicionar(gr.inv.items.filter((o) => o.def.key === it.def.key));
      else if (a === "abrir") abrirMochilaGuardada(it);
      else if (a === "qvbag") qvItemTo(it, gr, "bag");
      else if (a === "qvgnd") qvItemTo(it, gr, "ground");
      else if (a === "eat") {
        const h =
          (dungeon.active && dungeon.hero) ||
          (prep.open && prepHero()) ||
          (bag.open && world.heroes.find((x) => x.id === bag.heroId)) ||
          world.heroes[0];
        itemMsg(eatItem(h, it, gr.inv));
        renderInv();
        if (prep.open) renderPrep();
      } else if (a === "study") {
        itemMsg(forgeStudy(it, gr));
        renderInv();
        if (prep.open) renderPrep();
      } else if (a === "dism") {
        itemMsg(forgeDismantle(it, gr));
        renderInv();
        if (prep.open) renderPrep();
      } else if (a === "insp") {
        itemMsg(inspectStone(it, gr));
        renderInv();
        if (prep.open) renderPrep();
      } else if (a === "equip") {
        if (dungeon.active && dungeon.invOpen) {
          itemMsg(equipItem(dungeon.hero!, it, gr.inv));
          GL3.heroKey = "";
          renderInv();
        } else {
          const h = prepHero()!;
          document.getElementById("prep-msg")!.textContent = equipItem(h, it, gr.inv);
          renderPrep();
        }
      }
      m!.remove();
    });
    setTimeout(
      () =>
        window.addEventListener(
          "pointerdown",
          function f(ev) {
            if (!m!.contains(ev.target as Node)) {
              m!.remove();
              window.removeEventListener("pointerdown", f, true);
            }
          },
          true,
        ),
      0,
    );
  }
  try {
    invMenuPacotes(it, gr, x, y);
  } catch (e) {
    console.warn(e);
  } // v6.6
  try {
    invMenuGalho(it, gr, x, y);
  } catch (e) {
    console.warn(e);
  } // v7.3b
}
function sendToCamp(it: Item, gr: GradeTela) {
  enviarAoAcampamento([{ it, gr }]);
}
/** Manda os itens direto para o estoque do acampamento (não ficam no baú nem na mochila); v7.7: vários de uma vez
    (seleção da mochila, items/selecao_inv.ts), com um aviso só. Os que não vão (CAMP_SEND) ficam. Devolve quantos foram. */
export function enviarAoAcampamento(lista: { it: Item; gr: GradeTela }[]) {
  const h = (dungeon.active && dungeon.hero) || world.heroes[0];
  if (!h) return 0;
  h.loot = h.loot || {};
  let wood = 0,
    meat = 0,
    n = 0;
  for (const { it, gr } of lista) {
    const inv = gr.inv,
      i = inv.items.indexOf(it);
    if (i < 0 || !CAMP_SEND[it.def.key]) continue;
    const g = CAMP_SEND[it.def.key](it);
    inv.items.splice(i, 1);
    if (inv.ground) groundTake(it);
    wood += g.wood || 0;
    meat += g.meat || 0;
    n++;
  }
  if (!n) return 0;
  if (wood) h.loot.wood = (h.loot.wood || 0) + wood;
  if (meat) h.loot.meat = (h.loot.meat || 0) + meat;
  const partes = [meat ? meat + " de comida" : "", wood ? wood + " lenha" : ""].filter(Boolean).join(" e ");
  const txt = "⛺ +" + partes + " no acampamento";
  if (dungeon.active) spawnDungeonToast(txt, dungeon.px, dungeon.py - 46, "#cfe8a0", 12);
  else mvToast(txt);
  pushEvent(
    h.name +
      " enviou " +
      (n === 1 ? lista[0].it.def.name.toLowerCase() : n + " itens") +
      " ao acampamento (" +
      partes +
      ").",
  );
  renderInv();
  updateEcon();
  return n;
}
export function closeChest() {
  INV.chestOpen = false;
  INV.invDrag = null;
  INV.invGrids = [];
  document.getElementById("chest-modal")!.classList.remove("open");
  updateEcon();
  prepVoltarDoBau(); // v7.7: aberto pelo Baú da preparação, volta para ela
}
