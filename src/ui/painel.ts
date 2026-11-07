/* ==== Fase 4 — painéis do mapa: relógio, estatísticas, habitat, eventos (base/01) ==== */
import { SKILL_LABELS, HERO_STATE_LABEL, HERO_MAX_SLOTS } from "../data/herois.ts";
import { updateEcon, bag, meatInPack, settleMeat } from "../econ/economia.ts";
import { INV } from "../items/inventario.ts";
import { renderBag, openBag, clearInspExtras } from "./janelas.ts";
import { world, SEL, MEMO, camera } from "../core/state.ts";
import { openSheet } from "./ficha.ts";
import { icoTag, icoPortrait } from "./icones.ts";
import { HUNT_TARGETS } from "../data/recursos.ts";
import { verboTrabalho } from "../data/mapa.ts";
import { treePoints } from "../hero/nivel.ts";
import { CONFIG } from "../core/config.ts";
import { fmtClock, clamp } from "../core/util.ts";
import { WILD_CAP, SPECIES, HAB_WINDOW_MIN, ALL_KEYS, WILD_KEYS, SP_UI, PLANTS } from "../data/especies.ts";
import { coatInfo } from "../data/genetica.ts";
import { camZoomTo, enterCamp } from "../survival/acampamento.ts";
import { entrarNoCampo } from "../map/transicao.ts";
import { selecionarHeroi } from "../map/selecao.ts";
import { estadosDe, alternarPainel } from "../field/estados.ts";
import { openCreateModal } from "./criacao.ts";
import { enterDungeon } from "../expedicao/preparo.ts";
import { treinoDeQualquerLugar } from "../field/treino.ts";
import { mvToast } from "./avisos.ts";
import { openMarket } from "../econ/mercado.ts";
import { MAPCTL, mapHero } from "../map/controle.ts";
import type { Animal, Hero, Planta, Wild } from "../core/tipos.ts";

export function skillsLineHtml(h: Hero) {
  const keys = Object.keys(h.skills);
  if (!keys.length) return '<span class="no-skill">nenhuma perícia ainda — use algo pra desenvolver</span>';
  return keys.map((k) => SKILL_LABELS[k] + " Nv." + h.skills[k].level).join(" · ");
}
/* v8.1 — o painel do clã (mantenedor, 2026-10-30: "muita informação e pouco controle"; vários personagens trabalhando
   sozinhos enquanto você joga com um, ou só gerencia). Um cartão por personagem: nome, o que está fazendo (com a
   barra do trabalho), a vida e os alertas; clique seleciona (como no mapa), clique de novo centraliza. Embaixo, as
   ordens só de quem está em foco (o selecionado; sem seleção, a heroína do mapa): o trabalho (presa e horas), andar,
   entrar no campo, voltar, vender, acampamento e a Dungeon Teste. Atributos e perícias ficam na ficha (📜). */
/** O que o personagem está fazendo: ícone, texto curto e o progresso do trabalho (0..1, ou null). */
function atividade(h: Hero): { txt: string; prog: number | null } {
  const T = h.task,
    verbo = T ? verboTrabalho(T.targetSpecies) : "";
  switch (h.state) {
    case "idle":
      return { txt: "⛺ No acampamento", prog: null };
    case "field":
      return { txt: "🌲 Parada no mapa", prog: null };
    case "walking":
      return { txt: h._enterCamp ? "⛺ Indo ao acampamento" : "🚶 Andando", prog: null };
    case "traveling":
      return { txt: "→ " + (verbo || "A caminho"), prog: null };
    case "hunting": {
      const max = (T && T.maxMin) || 0,
        resta = Math.max(0, Math.round(((max - h.huntTimer) / 60) * 10) / 10);
      return {
        txt: verbo + (T && T.killsDone ? " · " + T.killsDone : "") + " · " + resta + "h",
        prog: max ? Math.min(1, h.huntTimer / max) : null,
      };
    }
    case "indungeon":
      return { txt: "⚔ No campo, com você", prog: null };
    default:
      return { txt: (HERO_STATE_LABEL[h.state] || h.state) + (h.trip ? " · " + h.trip.city.name : ""), prog: null };
  }
}
/** Quem as ordens do painel comandam: o único selecionado; sem seleção, a heroína do mapa (ou a primeira). */
function heroiEmFoco() {
  const sel = SEL.grupo.length === 1 ? world.heroes.find((h) => h.id === SEL.grupo[0]) : null;
  return sel || mapHero() || world.heroes[0] || null;
}
function cartaoHeroi(h: Hero, foco: boolean) {
  settleMeat(h);
  const a = atividade(h),
    vida = h.hpMax ? Math.max(0, Math.min(1, h.hp / h.hpMax)) : 1,
    alertas =
      (treePoints(h) > 0 ? '<i class="cla-alerta" title="Ponto de nível para gastar na ficha">●</i>' : "") +
      (vida < 0.35 ? '<i class="cla-alerta ferida" title="Vida baixa">✚</i>' : "") +
      // v8.1: os mesmos estados de perto dela (field/estados.ts); clicar abre o painel completo
      estadosDe(h)
        .slice(0, 2)
        .map(
          (e) =>
            '<i class="cla-selo ' +
            e.nivel +
            '" data-est-heroi="' +
            h.id +
            '" title="' +
            e.nome +
            ": " +
            e.efeito +
            '">' +
            e.ico +
            "</i>",
        )
        .join("");
  return (
    '<div class="cla-card' +
    (foco ? " foco" : "") +
    (SEL.grupo.includes(h.id) ? " sel" : "") +
    '" data-cla="' +
    h.id +
    '"><span class="dot" style="background:' +
    h.color +
    '"></span><div class="cla-meio"><div class="cla-topo"><b class="cla-nome">' +
    h.name +
    '</b><span class="cla-nv">Nv.' +
    (h.lvl || 1) +
    "</span>" +
    alertas +
    '</div><div class="cla-ativ">' +
    a.txt +
    "</div>" +
    (a.prog != null
      ? '<div class="cla-barra prog"><i style="width:' + Math.round(a.prog * 100) + '%"></i></div>'
      : "") +
    '<div class="cla-barra vida"><i style="width:' +
    Math.round(vida * 100) +
    '%"></i></div></div></div>'
  );
}
function ordensHeroi(h: Hero) {
  const idle = h.state === "idle",
    fld = h.state === "field",
    livre = idle || fld,
    b = (act: string, txt: string, title = "") =>
      '<button class="btn hero-btn" data-act="' +
      act +
      '" data-hero="' +
      h.id +
      '" title="' +
      title +
      '">' +
      txt +
      "</button>",
    armed = SEL.commandMode === h.id;
  let html =
    '<div class="cla-ordens"><div class="cla-ordens-topo"><b>' +
    h.name +
    '</b><span class="cla-comida">' +
    icoTag("ui_comida", "🥩") +
    " " +
    (h.loot.meat + meatInPack(h)) +
    '</span><button class="btn hero-btn sheet-btn" data-act="sheet" data-hero="' +
    h.id +
    '" title="Ficha do personagem"><i class="ic ico-btn_ficha"></i></button><button class="btn hero-btn bag-btn" data-act="bag" data-hero="' +
    h.id +
    '" title="Abrir a mochila"><i class="ic ico-btn_mochila"></i></button></div>';
  if (!livre) {
    html += '<div class="cla-ocupado">' + atividade(h).txt + "</div></div>";
    return html;
  }
  html +=
    '<div class="cla-trab"><select class="hunt-sel" data-sel="species" data-hero="' +
    h.id +
    '" title="O que fazer">' +
    HUNT_TARGETS.map(
      (t) => '<option value="' + t[0] + '"' + (h.huntSpecies === t[0] ? " selected" : "") + ">" + t[1] + "</option>",
    ).join("") +
    '</select><select class="hunt-sel" data-sel="hours" data-hero="' +
    h.id +
    '" title="Por quanto tempo (mais horas = área maior)">' +
    [2, 4, 6, 12, 24, 48]
      .map((n) => '<option value="' + n + '"' + (h.huntHours === n ? " selected" : "") + ">" + n + "h</option>")
      .join("") +
    '</select></div><div class="cla-linha">' +
    b(
      "huntz",
      verboTrabalho(h.huntSpecies || "rabbit") + " aqui",
      "Trabalha em volta de onde ela está; mais horas = área maior. Atalho: selecione e clique com o botão direito no bicho, árvore, pedra ou água",
    ) +
    (armed
      ? '<button class="btn hero-btn active" data-act="walk" data-hero="' +
        h.id +
        '">🚶 Toque no mapa… (cancelar)</button>'
      : b("walk", "🚶 Andar", "Toque no mapa para ela andar até lá")) +
    '</div><div class="cla-linha">' +
    (idle
      ? b("enter", "⚔ Expedição", "Preparar e sair em expedição")
      : b("jogar", "▶ Jogar com ela", "Entrar no campo com ela (ou E)")) +
    (idle
      ? b("camp", "⛺ Acampamento", "Entrar no acampamento: fogueira, bigorna e descanso")
      : b("back", "⛺ Voltar", "Voltar ao acampamento")) +
    '</div><div class="cla-linha">' +
    (idle ? b("sell", "💰 Vender", "Mandar vender no mercado") : "") +
    '<button class="btn hero-btn test-btn" data-act="dtest" data-hero="' +
    h.id +
    '" title="Campo de treino: boneco e alvo para testar dano, armas e atributos; manequins dos personagens (E veste)"><i class="ic ico-btn_teste"></i> Treino</button></div></div>';
  return html;
}
export function updateHeroPanelUI() {
  updateEcon();
  if (bag.open && !INV.invDrag) renderBag();
  const real = document.getElementById("hero-rows")!;
  const foco = heroiEmFoco();
  let html = '<div class="cla-faixa">' + world.heroes.map((h) => cartaoHeroi(h, h === foco)).join("");
  html +=
    world.heroes.length < HERO_MAX_SLOTS
      ? '<button class="btn cla-novo" id="btn-open-create" title="Criar personagem">+</button>'
      : "";
  html += "</div>" + (foco ? ordensHeroi(foco) : "");
  // v7.7: com uma lista de escolha do painel aberta (presa, horas), não refaz o painel: refazer fechava a lista na mão
  // do jogador (o "restam Xh" muda a cada pouco durante a caça)
  const f = document.activeElement;
  if (f && f.tagName === "SELECT" && real.contains(f)) return;
  const box = document.createElement("div");
  box.innerHTML = html; // o texto como o navegador o escreve: compara com o de agora sem refazer à toa
  if (real.innerHTML !== box.innerHTML) real.innerHTML = box.innerHTML;
}

export function phaseLabel(min: number) {
  const t = min % CONFIG.DAY_MIN;
  if (t > 5.5 * 60 && t < 7.5 * 60) return "Amanhecer";
  if (t >= 7.5 * 60 && t < 17.5 * 60) return "Dia";
  if (t >= 17.5 * 60 && t < 19.5 * 60) return "Entardecer";
  return "Noite";
}
/** v7.7 — o que os painéis mostraram por último: só mexe no DOM quando muda (era reescrito a cada quadro). */
const UI_ULT = { dia: "", hora: "", barra: "", hab: null as unknown, hist: "" };
export function updateClockUI() {
  const tod = world.tick % CONFIG.DAY_MIN;
  const dia = "Dia " + (Math.floor(world.tick / CONFIG.DAY_MIN) + 1),
    hora = fmtClock(world.tick) + " · " + phaseLabel(world.tick),
    barra = ((tod / CONFIG.DAY_MIN) * 100).toFixed(1) + "%";
  if (dia !== UI_ULT.dia) document.getElementById("day-label")!.textContent = UI_ULT.dia = dia;
  if (hora !== UI_ULT.hora) document.getElementById("day-time-label")!.textContent = UI_ULT.hora = hora;
  if (barra !== UI_ULT.barra) document.getElementById("day-bar-fill")!.style.width = UI_ULT.barra = barra;
}
function spCap(k: string) {
  return WILD_CAP[k] || SPECIES[k].carryingCapacity;
}
/** O que o painel de habitat mostra (MEMO._habCache). */
export type Habitat = ReturnType<typeof analyzeHabitat>;
function analyzeHabitat() {
  const out = [],
    since = world.tick - HAB_WINDOW_MIN;
  for (const k of ALL_KEYS) {
    const wild = WILD_KEYS.indexOf(k) >= 0;
    const list = wild
      ? world.wild!.filter((o) => o.alive && o.species === k)
      : world.animals.filter((o) => o.alive && o.species === k);
    const pop = list.length,
      cap = spCap(k);
    const avg = (f: (o: Animal & Wild) => number) =>
      pop ? list.reduce((s, o) => s + f(o as Animal & Wild), 0) / pop : null; // cada chamada só lê campos da sua lista (bichos ou selvagens)
    const fed = wild ? avg((o: Wild) => 100 - o.hunger) : avg((o: Animal) => o.hunger);
    const health = wild ? avg((o: Wild) => (o.hp == null ? 100 : o.hp)) : avg((o: Animal) => o.health);
    const energy = wild ? null : avg((o: Animal) => o.energy);
    const thirst = wild ? null : avg((o: Animal) => o.thirst);
    let births = 0,
      deaths = 0;
    const causes: Record<string, number> = {};
    for (const e of world.spLog) {
      if (e.sp !== k || e.t < since) continue;
      if (e.type === "birth") births++;
      else {
        deaths++;
        if (e.cause) causes[e.cause] = (causes[e.cause] || 0) + 1;
      }
    }
    const hist = world.statsHistory[k] || [],
      prev = hist.length > 25 ? hist[hist.length - 25] : hist[0] != null ? hist[0] : pop;
    const trend = pop - prev;
    // POSITIVOS ALTOS (fome saciada, saúde, energia, nascimentos, ocupação) · NEGATIVOS BAIXOS (sede, mortes)
    const parts = [
      [fed, 0.3],
      [health, 0.25],
      [energy, 0.15],
      [thirst == null ? null : 100 - thirst, 0.15],
    ].filter((p) => p[0] != null) as number[][];
    const wsum = parts.reduce((s, p) => s + p[1], 0),
      vitals = pop ? parts.reduce((s, p) => s + p[0] * p[1], 0) / wsum : 0;
    const demog = births + deaths === 0 ? 50 : 50 + (50 * (births - deaths)) / (births + deaths);
    const r = pop / cap,
      occ = r < 0.35 ? (100 * r) / 0.35 : r <= 0.85 ? 100 : Math.max(0, 100 - (r - 0.85) * 250);
    const score = pop ? Math.round(clamp(0.45 * vitals + 0.3 * demog + 0.25 * occ, 0, 100)) : 0;
    const rating = !pop
      ? ["Extinta (pode migrar de volta)", "#8a8a8a"]
      : score >= 75
        ? ["Prosperando", "#5fd08a"]
        : score >= 55
          ? ["Estável", "#d6c75f"]
          : score >= 35
            ? ["Pressionada", "#e0a14f"]
            : ["Em colapso", "#e0605f"];
    const coatCount: Record<string, number> = {};
    for (const o of list) {
      const nm = coatInfo(k, wild ? (o as Wild).coat : (o as Animal).genes.coat)!.name;
      coatCount[nm] = (coatCount[nm] || 0) + 1;
    }
    const coats = Object.entries(coatCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    const tot = world.spTotals[k] || { immigrants: 0 };
    out.push({
      key: k,
      label: SP_UI[k].label,
      color: SP_UI[k].color,
      pop,
      cap,
      trend,
      fed,
      health,
      energy,
      thirst,
      births,
      deaths,
      causes,
      score,
      rating,
      coats,
      immigrants: tot.immigrants || 0,
    });
  }
  return out;
}
function habitatCached() {
  const n = performance.now();
  if (!MEMO._habCache || n - MEMO._habAt > 1500) {
    MEMO._habCache = analyzeHabitat();
    MEMO._habAt = n;
  }
  return MEMO._habCache;
}
export function updateStatsUI() {
  const rows = document.getElementById("species-rows")!;
  // v7.7: as linhas (e os 6 gráficos) só são refeitas quando a análise ou o histórico mudam (antes, 4 vezes por segundo)
  const hab = habitatCached(),
    hist = ALL_KEYS.map((k) => {
      const H = world.statsHistory[k] || [];
      return H.length + ":" + H[H.length - 1];
    }).join(",");
  if (hab === UI_ULT.hab && hist === UI_ULT.hist && rows.childElementCount) {
    if (document.getElementById("hab-modal")!.classList.contains("open")) renderHabitat();
    return;
  }
  UI_ULT.hab = hab;
  UI_ULT.hist = hist;
  rows.innerHTML = "";
  for (const h of hab) {
    const row = document.createElement("div");
    row.className = "species-row";
    row.innerHTML =
      '<span class="dot" style="background:' +
      h.color +
      '"></span>' +
      '<span class="label">' +
      h.label +
      "</span>" +
      '<span class="count" title="' +
      h.rating[0] +
      '">' +
      h.pop +
      ' <i style="font-style:normal;font-size:.62rem;color:' +
      h.rating[1] +
      '">●' +
      h.score +
      "</i></span>";
    rows.appendChild(row);
    const spark = document.createElement("canvas");
    spark.className = "spark";
    spark.width = 160;
    spark.height = 16;
    rows.appendChild(spark);
    drawSparkline(spark, world.statsHistory[h.key] || [], h.color);
  }
  if (document.getElementById("hab-modal")!.classList.contains("open")) renderHabitat();
}
export function renderHabitat() {
  const H = analyzeHabitat().sort((a, b) => b.score - a.score),
    $ = (i: string) => document.getElementById(i);
  const fmt = (v: number | null) => (v == null ? "—" : Math.round(v) + "%");
  $("hab-body")!.innerHTML = H.map((h) => {
    const tr =
      h.trend > 0
        ? '<b style="color:#3f8f4a">▲ +' + h.trend + "</b>"
        : h.trend < 0
          ? '<b style="color:#b3473f">▼ ' + h.trend + "</b>"
          : "■ estável";
    const cs =
      Object.entries(h.causes as Record<string, number>)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map((c) => c[0] + " ×" + c[1])
        .join(", ") || "nenhuma";
    return (
      '<div class="hab-card" style="border-left:5px solid ' +
      h.color +
      '"><div class="hab-top"><b>' +
      h.label +
      '</b><span class="hab-score" style="background:' +
      h.rating[1] +
      '">' +
      h.score +
      " · " +
      h.rating[0] +
      "</span></div>" +
      '<div class="hab-bar"><i style="width:' +
      h.score +
      "%;background:" +
      h.rating[1] +
      '"></i></div>' +
      '<div class="hab-grid"><span>População <b>' +
      h.pop +
      "/" +
      h.cap +
      "</b> " +
      tr +
      "</span><span>Alimentação <b>" +
      fmt(h.fed) +
      "</b></span><span>Saúde <b>" +
      fmt(h.health) +
      "</b></span><span>Energia <b>" +
      fmt(h.energy) +
      "</b></span><span>Sede <b>" +
      fmt(h.thirst) +
      "</b></span>" +
      "<span>Nascimentos (3d) <b>" +
      h.births +
      "</b></span><span>Mortes (3d) <b>" +
      h.deaths +
      "</b></span><span>Migrações <b>" +
      h.immigrants +
      "</b></span></div>" +
      '<div class="hab-small">Causas de morte: ' +
      cs +
      "</div>" +
      '<div class="hab-small">Pelagens: ' +
      (h.coats.map((c) => c[0] + " ×" + c[1]).join(", ") || "—") +
      "</div></div>"
    );
  }).join("");
}
function drawSparkline(canvasEl: HTMLCanvasElement, data: number[], color: string | CanvasGradient | CanvasPattern) {
  const c = canvasEl.getContext("2d")!;
  c.clearRect(0, 0, canvasEl.width, canvasEl.height);
  if (data.length < 2) return;
  const max = Math.max(1, ...data);
  c.beginPath();
  c.strokeStyle = color;
  c.lineWidth = 1.4;
  data.forEach((v: number, i: number) => {
    const x = (i / (data.length - 1)) * canvasEl.width;
    const y = canvasEl.height - (v / max) * (canvasEl.height - 3) - 2;
    i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
  });
  c.stroke();
}
// delegação de evento única (ligada uma vez no init) em vez de religar botão
// por botão a cada atualização do painel — é bem mais leve.
export function onHeroPanelClick(e: MouseEvent) {
  if ((e.target as HTMLElement).id === "btn-open-create") {
    openCreateModal();
    return;
  }
  {
    // v8.1: o selo de um estado no cartão abre o painel completo daquele personagem
    const s = (e.target as HTMLElement).closest<HTMLElement>("[data-est-heroi]"),
      h = s && world.heroes.find((x) => x.id === s.dataset.estHeroi);
    if (h) {
      alternarPainel(h);
      return;
    }
  }
  const btn = (e.target as HTMLElement).closest<HTMLElement>(".hero-btn[data-hero]");
  if (!btn) {
    // v8.1: o cartão do clã seleciona; clicar de novo no mesmo centraliza a câmera nela
    const card = (e.target as HTMLElement).closest<HTMLElement>(".cla-card[data-cla]"),
      h = card && world.heroes.find((x) => x.id === card.dataset.cla);
    if (!h) return;
    if (SEL.grupo.length === 1 && SEL.grupo[0] === h.id && h.state !== "indungeon")
      camZoomTo(h.x, h.y, camera.scale, 320);
    selecionarHeroi(h);
    return;
  }
  const id = btn.dataset.hero!;
  if (btn.dataset.act === "jogar") {
    const h = world.heroes.find((x) => x.id === id);
    if (h) entrarNoCampo(h); // v8.1: entra no campo com ela (o mesmo do E e da roda no mapa)
    return;
  }
  if (btn.dataset.act === "sheet") {
    openSheet(id);
    return;
  }
  if (btn.dataset.act === "bag") {
    openBag(id);
    return;
  }
  if (btn.dataset.act === "enter") {
    enterDungeon(id);
    return;
  }
  if (btn.dataset.act === "dtest") {
    mvToast("🧪 " + treinoDeQualquerLugar(id));
    return;
  }
  if (btn.dataset.act === "camp") {
    enterCamp(world.heroes.find((x) => x.id === id));
    return;
  }
  if (btn.dataset.act === "sell") {
    openMarket(id);
    return;
  }
  SEL.commandMode = SEL.commandMode === id ? null : id;
  document.getElementById("command-hint")!.style.display = SEL.commandMode ? "block" : "none";
  updateHeroPanelUI();
}
export function updateEventFeedUI() {
  if (!SEL.renderEventFeedDirty) return;
  SEL.renderEventFeedDirty = false;
  const list = document.getElementById("event-list")!;
  const recent = world.events.slice(-10).reverse();
  list.innerHTML = recent
    .map((e) => '<div class="event-line"><span class="t">' + fmtClock(e.tick) + "</span>" + e.text + "</div>")
    .join("");
}
export function openPlantInspector(p: Planta) {
  /* v6.4 */
  if (performance.now() - MAPCTL.clickT < 120) return;
  SEL.selectedWild = null;
  SEL.selectedHero = null;
  SEL.selectedCity = null;
  clearInspExtras();
  SEL.selectedAnimal = null;
  SEL.selectedPlant = p;
  const def = PLANTS[p.kind];
  document.getElementById("insp-tag")!.textContent = "FLORA";
  document.getElementById("insp-tag")!.style.background = def.color;
  document.getElementById("insp-tag")!.style.color = "#1c140b";
  document.getElementById("insp-name")!.textContent = def.label;
  icoPortrait(null);
  document.getElementById("insp-id")!.textContent = def.tag;
  document.getElementById("v-growth")!.textContent = Math.round(p.growth * 100) + "%";
  document.getElementById("b-growth")!.style.width = p.growth * 100 + "%";
  document.getElementById("insp-desc")!.textContent = def.desc;
  document.getElementById("insp-meta-plant")!.textContent =
    "Posição: (" + Math.round(p.x) + ", " + Math.round(p.y) + ")  ·  Floresta Central";
  document.getElementById("insp-animal-stats")!.style.display = "none";
  document.getElementById("insp-plant-info")!.style.display = "block";
  document.getElementById("inspector")!.classList.add("open");
}
