/* ==== v7.7 — painel de ações no canto (estilo Red Dead): o que dá para fazer agora, com a tecla ====
   Substitui o texto que flutuava acima do herói ("[E] Pegar …", drawDungeonLoot) e o aviso do acampamento
   (#camp-prompt). As ações seguem a MESMA ordem do interact() (masmorra.ts): a linha do E diz o que o E faz.
   Abaixo da ação, depois de um traço, o detalhe (o item e a qualidade, o elemento da runa…). No celular a tecla
   E vira ✋ (o botão de toque que chama interact()).
   E num item do chão: toque rápido pega (vai direto para a mochila); SEGURAR (SEGURAR_E) pega e abre a mochila com o
   item preso ao cursor, para arrumar onde quiser (a linha "Segure · arrumar na mochila", com o círculo enchendo). */
import { dungeon, econ } from "../core/state.ts";
import { RUNE_EL } from "../data/runas.ts";
import { TIERS, INV } from "../items/inventario.ts";
import { lootInfo, nearestLoot, inExitZone, interact } from "../field/masmorra.ts";
import { toggleInv, renderInv } from "../field/chao.ts";
import { finishTarget } from "../field/faca_corda.ts";
import { facaNoCinto } from "../items/cinto.ts";
import { spearStuckNear, spearGroundNear } from "../field/armas.ts";
import { dfireNear } from "../field/fogueira.ts";
import { runeNearDungeon } from "../runas/runas.ts";
import { campNear, CAMP } from "../survival/acampamento.ts";
import { mountNear, mnt, MP } from "../creatures/tamandua.ts";
import { CT } from "../intro/tutorial.ts";
import { ISC } from "../intro/cena.ts";
import { eLootFirst } from "./icones.ts";
import { MOB } from "./celular.ts";
import { desenharDica } from "./dicas.ts";
import { ehNoite, pertoDaCama } from "../campanha/sono.ts";
import { chamadoAtual } from "../campanha/campanha.ts";
import { acaoCercado } from "../campanha/cercado.ts";
import { vilaPerto } from "../map/vila_cena.ts";
import { manequimPerto } from "../field/treino.ts";
import { VESTIDO } from "../render/gl/vestidos.ts";
import { pedidoAtual, pedidoEntregavel } from "../campanha/pedidos.ts";
import { pedraCampoPerto, recursoCampoPerto } from "../field/recursos_campo.ts";
import { wpnKey } from "../field/armas.ts";
import { bandidoPoupavel } from "../field/bandidos.ts";
import type { LootChao } from "../core/tipos.ts";

/** Quanto segurar o E (s) para pegar e abrir a mochila. */
const SEGURAR_E = 0.45;

/** Uma linha do painel: tecla ("" = só informação), ação e o detalhe opcional (HTML curto). */
interface AcaoTela {
  tecla: string;
  texto: string;
  detalhe?: string;
  loot?: LootChao; // o E pega este item do chão
  segurar?: boolean; // linha do "segure E"
  mouse?: boolean; // tecla é um botão do mouse (Esq/Dir)
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Nome do item no chão + a qualidade na cor dela. */
function detalheItem(l: LootChao) {
  const def = lootInfo(l),
    t = l.tier ? TIERS[l.tier] : null;
  return esc(def.name) + (t ? ` <b style="color:${t.col}">${t.lab}</b>` : "");
}

/** A ação do E (na ordem do interact()) e as outras teclas de contexto. */
export function acoesAgora(): AcaoTela[] {
  const d = dungeon;
  if (!d.active || d.dead || d.invOpen || d.craftOpen || d.modalOpen || ISC.dlg || CAMP.open || MP.open) return [];
  const L: AcaoTela[] = [],
    E = (texto: string, detalhe?: string): void => {
      L.push({ tecla: "E", texto, detalhe });
    },
    pegar = (l: LootChao): void => {
      L.push({ tecla: "E", texto: "Pegar", detalhe: detalheItem(l), loot: l });
      L.push({ tecla: "E", texto: "Segure · arrumar na mochila", segurar: true });
    },
    info = (texto: string): void => {
      L.push({ tecla: "", texto });
    };
  /* arma de perto cravada no bicho: segurar o esquerdo empurra (cravPress), o direito arranca (cravRip) */
  if (d.crav) {
    L.push({ tecla: "Esq", texto: d.crav.hold ? "Empurrando…" : "Segure · empurrar a arma", mouse: true });
    L.push({ tecla: "Dir", texto: "Arrancar a arma", detalhe: esc((d.crav.m.name || "").toLowerCase()), mouse: true });
    return L;
  }
  const acaoE = (): void => {
    /* v8.0 — a vila andável: a porta do lugar (mesma ordem do interact()) */
    if (d.vila) {
      const v = vilaPerto();
      if (v) return E(v.texto, v.detalhe);
    }
    /* v8.0 — sala de treino: o manequim de um personagem vestido (mesma ordem do interact()) */
    const q = manequimPerto();
    if (q) return VESTIDO.atual === q.nome ? E("Voltar a ser a heroína") : E("Vestir", esc(q.rotulo));
    if (d.camp) {
      const n = campNear();
      if (CT.unlit && n === "fire") return E("Acender a fogueira");
      if (n === "hunter" && !CT.on && chamadoAtual()) return E("Falar com o Caçador", "❗ ele quer falar com você");
      if (n === "hunter" && !CT.on && pedidoEntregavel()) return E("Entregar a carne", esc(pedidoAtual() || ""));
      if (econ.hunterNap && (n === "anvil" || n === "tools")) return info("O Caçador está dormindo");
      if (econ.hunterNap && n === "hunter") return info("O Caçador está cochilando");
      if (CT.on && n === "hunter") return E("Falar com o Caçador");
      const l = eLootFirst();
      if (l) return pegar(l);
      if (n === "hunter") return E("Conversar com o Caçador");
    } else {
      /* v7.7 — a lança cravada vem antes do finalizar (mesma ordem do interact()) */
      if (spearStuckNear()) return E("Arrancar a lança", finishTarget() ? "depois: finalizar" : undefined);
      const m = finishTarget();
      if (m && !d.finish)
        // v7.7: o atalho do abate só com uma faca no cinto (items/cinto.ts)
        return facaNoCinto(d.hero)
          ? E("Finalizar", esc((m.name || "").toLowerCase()))
          : info("Finalizar: faca no cinto");
    }
    if (d.camp) {
      const n = campNear();
      /* v7.7 — campanha: o cercado dos lobos (mesma ordem do interact()) */
      const c = acaoCercado();
      if (c) {
        L.push({ tecla: c.tecla ? "E" : "", texto: c.texto, detalhe: c.detalhe });
        return;
      }
      if (n === "tools") return E("Carpintaria", "maleta de ferramentas");
      if (n === "mesa") return E("Analisar itens", "mesa");
      if (n === "bau") return E("Abrir o baú", "do acampamento");
      if (n === "tenda") return E("Preparar a expedição", "tenda");
    }
    // v7.7: item no chão perto vem antes do tamanduá (os dois perto abria os alforjes)
    if (d.mount && !d.mount.mounted && mountNear() && !nearestLoot()) {
      const nome = mnt() ? esc(mnt()!.name) : "tamanduá";
      return d.camp ? E("Cuidar do tamanduá", nome) : E("Abrir os alforjes", nome);
    }
    if (!d.camp && dfireNear()) return E("Fogueira", "assar carne");
    if (spearStuckNear()) return E("Arrancar a lança");
    if (spearGroundNear()) return E("Pegar a lança");
    if (d.camp) {
      const n = campNear();
      if (n === "fire") return E("Fogueira", "assar carne");
      if (n === "anvil") return E("Bigorna", "forjar e consertar");
    }
    // v8.1: a ferramenta certa (o machado corta árvore, a picareta quebra pedra)
    const ferramenta = d.hero ? wpnKey(d.hero) : null;
    if (ferramenta === "eq_picareta" && d.weapon === "melee" && pedraCampoPerto()) {
      L.push({ tecla: "Dir", texto: "Quebrar pedra", detalhe: "solte no verde", mouse: true });
      return;
    }
    const recurso = recursoCampoPerto();
    if (recurso) {
      if (recurso.etapa === "arvore") {
        if (d.weapon === "melee")
          L.push({
            tecla: "Dir",
            texto: "Cortar árvore",
            detalhe: ferramenta === "eq_machado" ? "solte no verde" : "precisa do machado",
            mouse: true,
          });
        return;
      }
      if (!recurso.madeiraRecolhida) E("Coletar", "🪵 Madeira");
      if (recurso.qualidade === "verde" && d.weapon === "melee")
        L.push({ tecla: "Dir", texto: "Desgalhar", detalhe: "madeira de boa qualidade", mouse: true });
      return;
    }
    const l = nearestLoot();
    if (l) return pegar(l);
    const r = runeNearDungeon();
    if (r) return E("Absorver a runa", esc(RUNE_EL[r.el].n));
    if (inExitZone()) return E("Voltar ao mapa");
  };
  acaoE();
  // v8.1: o bandido caído também pode ser poupado (field/bandidos.ts)
  if (bandidoPoupavel()) L.push({ tecla: "R", texto: "Poupar", detalhe: "entrega algo, foge… ou trai" });
  if (d.mount && !d.mount.mounted && mountNear()) L.push({ tecla: "T", texto: "Montar" });
  /* v7.7 — campanha C1: dormir na barraca (campanha/sono.ts) */
  if (pertoDaCama()) L.push({ tecla: "Z", texto: ehNoite() ? "Dormir até o amanhecer" : "Dormir · só à noite" });
  return L;
}

/* ---------- E: toque rápido × segurar ---------- */
const SEG = { t0: 0, loot: null as LootChao | null, feito: false };

/** E apertado (teclado ou ✋): num item do chão, espera para ver se é toque ou segurar; nas outras ações, age já. */
export function eApertado() {
  const a = acoesAgora()[0];
  if (!a || !a.loot) {
    interact();
    return;
  }
  SEG.t0 = performance.now();
  SEG.loot = a.loot;
  SEG.feito = false;
}
/** E solto: se não chegou a segurar, foi um toque — pega direto. */
export function eSolto() {
  const l = SEG.loot;
  SEG.loot = null;
  if (l && !SEG.feito) interact();
}
/** Progresso do segurar (0..1); ao completar, pega e abre a mochila com o item na mão. */
function segurando() {
  if (!SEG.loot || SEG.feito) return 0;
  const p = (performance.now() - SEG.t0) / 1000 / SEGURAR_E;
  if (p < 1) return p;
  SEG.feito = true;
  pegarEArrumar(SEG.loot);
  return 0;
}
/** Abre a mochila com o item do chão preso ao cursor (sai do chão quando você o põe na mochila). */
function pegarEArrumar(l: LootChao) {
  const d = dungeon;
  if (!d.loot!.includes(l)) return;
  toggleInv(true);
  const gr = INV.invGrids.find((g) => g.inv === d.gInv),
    it = d.gInv && d.gInv.items.find((i) => i._loot === l);
  if (!gr || !it) return;
  INV.invDrag = {
    sx: 0,
    sy: 0,
    moved: true,
    it,
    from: gr,
    over: gr,
    shape: it.shape,
    ox: 0,
    oy: 0,
    gx: it.x,
    gy: it.y,
  };
  renderInv();
}

function painel() {
  let el = document.getElementById("acoes");
  if (!el) {
    el = document.createElement("div");
    el.id = "acoes";
    document.getElementById("dungeon-view")!.appendChild(el);
  }
  return el;
}

/** Atualiza o painel (chamado a cada quadro do campo e do acampamento). */
export function desenharAcoes() {
  const p = segurando(),
    L = acoesAgora(),
    tecla = (t: string) => (MOB.on ? ({ E: "✋", Esq: "⚔", Dir: "🛡" } as Record<string, string>)[t] || t : t),
    html = L.map(
      (a) =>
        `<div class="ac${a.tecla ? "" : " ac-info"}${a.segurar ? " ac-seg" : ""}"><span>${a.texto}</span>${a.tecla ? `<kbd${a.mouse && !MOB.on ? ' class="km"' : ""}>${tecla(a.tecla)}</kbd>` : ""}</div>` +
        (a.detalhe ? `<div class="ac-d">${a.detalhe}</div>` : ""),
    ).join("");
  const el = painel();
  if (el._h !== html) {
    el._h = html;
    el.innerHTML = html;
  }
  el.classList.toggle("on", L.length > 0);
  const k = el.querySelector<HTMLElement>(".ac-seg kbd");
  if (k) k.style.setProperty("--p", String(p));
  desenharDica();
}
