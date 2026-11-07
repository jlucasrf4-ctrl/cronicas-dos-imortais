/* ==== Fase 4 — menu da base ao tocar no personagem (v5.9.12) ==== */
import { campPos, enterCamp, nearCamp } from "../survival/acampamento.ts";
import { world, TELAS, camera, econ } from "../core/state.ts";
import { MAPCTL } from "../map/controle.ts";
import { carpOpen, carpProntas } from "../forja/carpintaria.ts";
import { updateHeroPanelUI } from "./painel.ts";
import { ensureHero } from "../hero/nivel.ts";
import { HUNT_TARGETS } from "../data/recursos.ts";
import { esc } from "../core/util.ts";
import { HERO_STATE_LABEL } from "../data/herois.ts";
import { HUNT_AREA_R, verboTrabalho } from "../data/mapa.ts";
import { anaOpen } from "../forja/analise.ts";
import { openPrep } from "../expedicao/preparo.ts";
import { huntHere, heroWalkArm, heroBack } from "../map/caca.ts";
import { openMarket } from "../econ/mercado.ts";
import { openSheet } from "./ficha.ts";
import { openBag, openHeroInspector } from "./janelas.ts";
import { chamadoAtual } from "../campanha/campanha.ts";
import type { Hero } from "../core/tipos.ts";

/* v7.7 — o balão sobre o acampamento só aparece com um motivo (antes era sempre "⚔ Expedição", repetindo o
   clique no acampamento): heroína que voltou ferida e já se recuperou, receita da carpintaria ao alcance.
   Tocar no balão abre a janela certa e o aviso some até o motivo voltar. */
interface AvisoBase {
  chave: string;
  txt: string;
  hero: string;
  tipo: "pronta" | "carp" | "chamado";
}
const AVISO = {
  feridas: new Set<string>(), // na base com a vida abaixo do máximo
  prontas: new Set<string>(), // estavam feridas e já se recuperaram
  vistos: new Set<string>(), // receitas já avisadas (voltam a avisar se deixarem de dar e voltarem)
  atual: null as AvisoBase | null,
  t: 0,
};
function avisoBase(): AvisoBase | null {
  for (const h of world.heroes) {
    if (h.state !== "idle" || h.hp == null) {
      AVISO.feridas.delete(h.id);
      AVISO.prontas.delete(h.id);
      continue;
    }
    if (h.hp < h.hpMax - 0.5) {
      AVISO.feridas.add(h.id);
      AVISO.prontas.delete(h.id);
    } else if (AVISO.feridas.delete(h.id)) AVISO.prontas.add(h.id);
  }
  const base = world.heroes.find((h) => h.state === "idle");
  if (!base) return null;
  // v7.7 — campanha: o Caçador chama (tocar entra no acampamento, onde ele está com o ❗)
  if (chamadoAtual()) return { chave: "chamado", txt: "❗ O Caçador quer falar", hero: base.id, tipo: "chamado" };
  for (const id of AVISO.prontas) {
    const h = world.heroes.find((x) => x.id === id);
    if (h) return { chave: "pronta:" + id, txt: "⚔ " + h.name + " recuperada", hero: id, tipo: "pronta" };
  }
  const carp = carpProntas();
  for (const k of AVISO.vistos) if (!carp.some((r) => "carp:" + r.id === k)) AVISO.vistos.delete(k);
  const r = carp.find((x) => !AVISO.vistos.has("carp:" + x.id));
  if (r) return { chave: "carp:" + r.id, txt: r.n + " — dá pra fazer", hero: base.id, tipo: "carp" };
  return null;
}
/** Toque no balão do acampamento (o ouvinte do mapa chama quando MAPCTL.bal.kind é "aviso"). */
export function avisoBaseAbrir() {
  const A = AVISO.atual;
  if (!A) return;
  const h = world.heroes.find((x) => x.id === A.hero);
  AVISO.atual = null;
  AVISO.t = 0;
  if (A.tipo === "chamado") {
    if (h && h.state === "idle") enterCamp(h);
  } else if (A.tipo === "pronta") {
    AVISO.prontas.delete(A.hero);
    if (h && h.state === "idle") openPrep(h.id);
  } else {
    AVISO.vistos.add(A.chave);
    if (h) carpOpen(h);
  }
}
/* balão de aviso sobre o acampamento no mapa (campDraw chama); fora do tutorial, também é o alvo do clique */
export function campDrawExpedicao() {
  const p = campPos();
  if (econ.campTut === 1) return;
  const agora = performance.now();
  if (agora - AVISO.t > 500) {
    AVISO.t = agora;
    AVISO.atual = avisoBase();
  }
  const A = AVISO.atual;
  if (!p || !A) {
    MAPCTL.bal = null;
    return;
  }
  const c = TELAS.ctx,
    t = agora / 1000,
    k = Math.max(0.6, Math.min(1.6, 1.2 / Math.sqrt(camera.scale / camera.minScale / 4))),
    y = p.y - 26 * k - 12 + Math.sin(t * 2.4) * 2 * k; // acima do nome de quem está na base
  c.save();
  c.font = "600 " + 9 * k + "px Cinzel, Lora, serif";
  const txt = A.txt,
    w = c.measureText(txt).width + 10 * k;
  c.fillStyle = "rgba(40,26,10,.88)";
  c.strokeStyle = "#e0b04a";
  c.lineWidth = 1 * k;
  if (c.roundRect) {
    c.beginPath();
    c.roundRect(p.x - w / 2, y - 7 * k, w, 14 * k, 6 * k);
    c.fill();
    c.stroke();
  } else {
    c.fillRect(p.x - w / 2, y - 7 * k, w, 14 * k);
    c.strokeRect(p.x - w / 2, y - 7 * k, w, 14 * k);
  }
  c.fillStyle = "#ffe2a0";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(txt, p.x, y + 0.5 * k);
  c.restore();
  MAPCTL.bal = { x: p.x, y, w, h: 14 * k, t: agora, kind: "aviso", hero: A.hero };
}

/* ==== v5.9.12 — tocar no personagem na base (ou no acampamento) abre a janela de ações: ⚔ Ir para a expedição ==== */
export function baseMenu(h: Hero) {
  if (performance.now() - MAPCTL.clickT < 120) return;
  if (h) MAPCTL.sel = h.id; // v6.4 — clique duplo no mapa não reabre
  if (h) {
    let m = document.getElementById("base-menu");
    if (!m) {
      m = document.createElement("div");
      m.id = "base-menu";
      m.className = "v3-modal";
      document.body.appendChild(m);
      m.addEventListener("click", (e) => {
        if (performance.now() - (m!._t0 || 0) < 450) return;
        if (e.target === m) {
          m!.classList.remove("open");
          return;
        }
        const b = (e.target as HTMLElement).closest("[data-bm]") as HTMLElement;
        if (!b) return;
        const H = world.heroes.find((x) => x.id === m!.dataset.hero);
        if (!H) return;
        const a = b.dataset.bm;
        if (a === "pick") {
          const n = world.heroes.find((x) => x.id === b.dataset.id);
          if (n) baseMenu(n);
          return;
        }
        m!.classList.remove("open");
        if (a === "exp") openPrep(H.id);
        else if (a === "camp") enterCamp(H);
        else if (a === "carp") carpOpen(H);
        else if (a === "hunt") huntHere(H);
        else if (a === "walk") heroWalkArm(H);
        else if (a === "back") heroBack(H);
        else if (a === "sell") openMarket(H.id);
        else if (a === "sheet") openSheet(H.id);
        else if (a === "bag") openBag(H.id);
        else if (a === "info") openHeroInspector(H);
        else if (a === "x") {
          // só fecha o menu
        }
      });
    }
    if (!m._sel) {
      m._sel = 1;
      m.addEventListener("change", (e) => {
        const sl = (e.target as HTMLElement).closest("[data-bms]") as HTMLInputElement;
        if (!sl) return;
        const H = world.heroes.find((x) => x.id === m.dataset.hero);
        if (!H) return;
        if (sl.dataset.bms === "species") H.huntSpecies = sl.value;
        else H.huntHours = +sl.value;
        baseMenu(H);
        updateHeroPanelUI();
      });
    }
    m.dataset.hero = h.id;
    ensureHero(h);
    const base = h.state === "idle",
      fld = h.state === "field",
      pct = Math.max(0, Math.min(100, Math.round((h.hp / h.hpMax) * 100))),
      others = world.heroes.filter((x) => x !== h && (x.state === "idle" || x.state === "field"));
    const hrs = h.huntHours || 6,
      sp = (HUNT_TARGETS.find((t) => t[0] === (h.huntSpecies || "rabbit")) || [0, "?"])[1];
    m.innerHTML =
      "<div class='v3-card bm-card'><div class='bm-head'><span class='dot' style='background:" +
      h.color +
      "'></span><b>" +
      esc(h.name) +
      "</b><small>" +
      HERO_STATE_LABEL[h.state] +
      "</small><button class='btn' data-bm='x'>✕</button></div>" +
      "<div class='bm-stats'><div class='bar'><i style='width:" +
      pct +
      "%'></i></div>❤ " +
      Math.round(h.hp) +
      "/" +
      h.hpMax +
      " · ⚡ " +
      Math.round(h.energy) +
      " · 🍖 fome " +
      Math.round(h.hunger) +
      "</div>" +
      (others.length
        ? "<div class='bm-pick'>" +
          others
            .map(
              (o) =>
                "<button class='btn' data-bm='pick' data-id='" +
                o.id +
                "'><span class='dot' style='background:" +
                o.color +
                "'></span>" +
                esc(o.name) +
                "</button>",
            )
            .join("") +
          "</div>"
        : "") +
      (base
        ? "<button class='btn pri bm-big' data-bm='exp'>⚔ Ir para a expedição<small>preparar mochila e equipamento e entrar no mundo</small></button>"
        : fld
          ? "<p class='bm-note'>Para ir à expedição, volte à base primeiro.</p><button class='btn pri bm-big' data-bm='back'>⛺ Voltar ao acampamento</button>"
          : "") +
      "<div class='bm-grid'>" +
      "<button class='btn' data-bm='hunt'>" +
      verboTrabalho(h.huntSpecies || "rabbit") + // v7.7: o verbo do trabalho escolhido (data/mapa.ts ORDEM)
      " aqui<small>" +
      sp +
      " · " +
      hrs +
      "h · área " +
      HUNT_AREA_R(hrs) +
      "</small></button><button class='btn' data-bm='walk'>🚶 Andar<small>toque no mapa depois</small></button>" +
      (base
        ? "<button class='btn' data-bm='camp'>⛺ Acampamento<small>fogueira e bigorna</small></button><button class='btn' data-bm='carp'>🪚 Carpintaria<small>tábuas, caixa, baú, mesa</small></button><button class='btn' data-bm='sell'>💰 Mercado</button>"
        : "") +
      "<button class='btn' data-bm='bag'>🎒 Mochila</button><button class='btn' data-bm='sheet'>📜 Ficha</button><button class='btn' data-bm='info'>🔍 Detalhes</button></div>" +
      "<div class='bm-sel'><select data-bms='species'>" +
      HUNT_TARGETS.map(
        (t) =>
          "<option value='" +
          t[0] +
          "'" +
          ((h.huntSpecies || "rabbit") === t[0] ? " selected" : "") +
          ">" +
          t[1] +
          "</option>",
      ).join("") +
      "</select><select data-bms='hours'>" +
      [2, 4, 6, 12, 24, 48]
        .map(
          (n) =>
            "<option value='" +
            n +
            "'" +
            (hrs === n ? " selected" : "") +
            ">" +
            n +
            "h · área " +
            HUNT_AREA_R(n) +
            "</option>",
        )
        .join("") +
      "</select></div></div>";
    m._t0 = performance.now();
    m.classList.add("open");
  }
  try {
    const g = document.querySelector("#base-menu .bm-grid");
    if (g && econ.mesa && h.state === "idle" && !g.querySelector("[data-bm-ana]")) {
      const b = document.createElement("button");
      b.className = "btn";
      b.dataset.bmAna = "1";
      b.innerHTML = "🔍 Mesa de análise<small>estudar itens, deduzir receitas</small>";
      b.onclick = (e) => {
        e.stopPropagation();
        document.getElementById("base-menu")!.classList.remove("open");
        anaOpen(h);
      };
      g.insertBefore(b, g.children[3] || null);
    }
  } catch (_) {} // v5.9.14 — botão da mesa de análise
}
export function baseTapAt(e: MouseEvent) {
  try {
    const vp = document.getElementById("viewport"),
      r = vp!.getBoundingClientRect(),
      wx = (e.clientX - r.left - camera.tx) / camera.scale,
      wy = (e.clientY - r.top - camera.ty) / camera.scale;
    if (!world.heroes.some((h) => h.state === "idle")) return false;
    if (nearCamp(wx, wy)) return true;
    return world.heroes.some(
      (h) =>
        (h.state === "idle" || h.state === "field") && Math.hypot(h.x - wx, h.y - wy) < Math.max(10, 16 / camera.scale),
    );
  } catch (_) {
    return false;
  }
}
