/* ==== v8.1 — estados da heroína perto dela: problemas, bônus e necessidades (mantenedor, 2026-10-31) ====
   Três estilos, cada um ligado nas Opções (OPT.estAnel, OPT.estSelos, OPT.estFita; pode mais de um):
   · Dentro do anel do fôlego: os de combate (tonta, debilitada, guarda quebrada) trocando a cada ESTADOS_UI.troca s;
     os de fora de combate (fome, frio, ferida, carga) aparecem como lembrete a cada ESTADOS_UI.lembrete s.
   · Selos na borda do anel: até ESTADOS_UI.selos, o mais grave primeiro; amarelo começando, vermelho prejudicando
     (pulsa), dourado bônus.
   · Fita sob os pés (#est-fita): cada estado com a barrinha do quanto tem ou falta; clicar abre o painel (#est-painel)
     com todos os efeitos e as barras de necessidades. O painel do clã (ui/painel.ts) mostra os mesmos selos e abre o
     mesmo painel.
   Estados novos (molhada, veneno, descanso, bônus de comida) entram em estadosDe e aparecem nos três sozinhos. */
import { dungeon, OPT, TELAS } from "../core/state.ts";
import { ESTADOS_UI, ESTADOS_LIM } from "../data/estados.ts";
import { heroCap, heroKg, loadK } from "../survival/sobrevivencia.ts";
import { D3 } from "./projecao.ts";
import { anelHeroi } from "./tipos.ts";
import type { Dungeon, Hero } from "../core/tipos.ts";

type Nivel = "alerta" | "perigo" | "bonus";
interface EstadoHeroi {
  id: string;
  ico: string;
  nome: string;
  nivel: Nivel;
  combate: boolean;
  efeito: string; // o que ele faz, em uma linha
  valor: string; // quanto falta ou quanto tem
  frac: number; // 0..1: a barrinha da fita
}

const COR: Record<Nivel, string> = { alerta: "#ffd23a", perigo: "#ff5a4a", bonus: "#f0c66e" };
const segs = (s: number) =>
  s >= 60 ? Math.floor(s / 60) + ":" + String(Math.round(s % 60)).padStart(2, "0") : Math.ceil(s) + " s";

/** Os estados de `h` agora, o mais grave primeiro (os de combate antes, no mesmo nível). `campo`: ela está no campo
    agora; os de combate só existem lá, e a vida e o ferimento vêm do campo. */
export function estadosDe(h: Hero, campo = dungeon.active && dungeon.hero === h): EstadoHeroi[] {
  const L = ESTADOS_LIM,
    d = dungeon,
    out: EstadoHeroi[] = [],
    nv = (v: number, lim: { alerta: number; perigo: number }): Nivel | null =>
      v > lim.perigo ? "perigo" : v > lim.alerta ? "alerta" : null;
  if (campo) {
    if (d.dazed! > 0)
      out.push({
        id: "tonta",
        ico: "💫",
        nome: "Tonta",
        nivel: "perigo",
        combate: true,
        efeito: "anda 35% mais devagar e ataca mais devagar",
        valor: segs(d.dazed!),
        frac: Math.min(1, d.dazed! / 5),
      });
    if ((d.debilitadoT || 0) > 0)
      out.push({
        id: "debilitada",
        ico: "🥵",
        nome: "Debilitada",
        nivel: "perigo",
        combate: true,
        efeito: "anda 15% mais devagar",
        valor: segs(d.debilitadoT!),
        frac: Math.min(1, d.debilitadoT! / 6),
      });
    if (d.guardBroken! > 0)
      out.push({
        id: "guarda",
        ico: "🛡",
        nome: "Guarda quebrada",
        nivel: "perigo",
        combate: true,
        efeito: "não dá para defender até ela voltar",
        valor: segs(d.guardBroken!),
        frac: Math.min(1, d.guardBroken! / 1.5),
      });
  }
  const fome = h.hunger || 0,
    nf = nv(fome, L.fome);
  if (nf)
    out.push({
      id: "fome",
      ico: "🍖",
      nome: nf === "perigo" ? "Faminta" : "Com fome",
      nivel: nf,
      combate: false,
      efeito:
        nf === "perigo"
          ? "perde vida aos poucos · fôlego e dano menores"
          : "fôlego recupera 20% mais devagar · dano −15%",
      valor: Math.round(fome) + "%",
      frac: fome / 100,
    });
  const frio = h.cold || 0,
    nfr = nv(frio, L.frio);
  if (nfr)
    out.push({
      id: "frio",
      ico: "🥶",
      nome: nfr === "perigo" ? "Congelando" : "Com frio",
      nivel: nfr,
      combate: false,
      efeito:
        nfr === "perigo" ? "perde vida · anda 15% mais devagar · fôlego −25%" : "fôlego −25% · a fome sobe mais rápido",
      valor: Math.round(frio) + "%",
      frac: frio / 100,
    });
  const vidaMax = campo ? d.hpMax : h.hpMax,
    ferida = (campo ? d.wound : h.wound) || 0,
    fr = vidaMax ? ferida / vidaMax : 0,
    nfe = nv(fr, L.ferida);
  if (nfe)
    out.push({
      id: "ferida",
      ico: "🩹",
      nome: "Ferida",
      nivel: nfe,
      combate: false,
      efeito: "a vida não volta além de −" + Math.round(ferida) + " até tratar (erva, carne assada, fogueira)",
      valor: "−" + Math.round(ferida),
      frac: Math.min(1, fr),
    });
  const carga = loadK(h),
    nc = nv(carga, L.carga);
  if (nc)
    out.push({
      id: "carga",
      ico: "🎒",
      nome: "Pesada",
      nivel: nc,
      combate: false,
      efeito: nc === "perigo" ? "anda 40% mais devagar · fôlego −30%" : "anda 20% mais devagar · fôlego −30%",
      valor: heroKg(h) + "/" + heroCap(h) + " kg",
      frac: Math.min(1, carga / 1.5),
    });
  const ordem = (e: EstadoHeroi) => (e.nivel === "perigo" ? 0 : e.nivel === "alerta" ? 2 : 4) + (e.combate ? 0 : 1);
  return out.sort((a, b) => ordem(a) - ordem(b));
}

/* ---------- no campo: dentro do anel, selos e fita ---------- */
/** O ciclo do anel: o que está nele, desde quando, a fila do lembrete e quando é o próximo. */
const ANEL = { atual: "", t0: 0, i: 0, fila: [] as string[], proximo: 0 };

/** O estado que o anel mostra agora: os de combate em roda; de tempos em tempos, os de fora de combate, um a um. */
function doAnel(lista: EstadoHeroi[], agora: number) {
  const U = ESTADOS_UI;
  if (!ANEL.proximo) ANEL.proximo = agora + U.lembrete * 1000;
  if (!ANEL.atual || agora - ANEL.t0 >= U.troca * 1000 || !lista.some((e) => e.id === ANEL.atual)) {
    ANEL.t0 = agora;
    const com = lista.filter((e) => e.combate);
    if (agora >= ANEL.proximo) {
      ANEL.fila = lista.filter((e) => !e.combate).map((e) => e.id);
      ANEL.proximo = agora + U.lembrete * 1000;
    }
    ANEL.atual = ANEL.fila.shift() || (com.length ? com[ANEL.i++ % com.length].id : "");
  }
  return lista.find((e) => e.id === ANEL.atual) || null;
}

/** Um elemento HTML por cima do campo (dentro do #dungeon-view, que some junto ao sair do campo). */
function camada(id: string) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    el.setAttribute("aria-hidden", "true");
    document.getElementById("dungeon-view")?.appendChild(el);
  }
  return el;
}
/** O HTML de um selo (o vermelho pulsa pelo CSS). */
const seloHtml = (e: EstadoHeroi) => '<span class="est-selo ' + e.nivel + '">' + e.ico + "</span>";

/** Os estados perto da heroína (combatFx chama logo depois do anel de fôlego): o do anel e os selos em HTML por cima
    do campo, presos ao anel (no canvas eles ficavam achatados no chão e pequenos demais), e a fita sob os pés. */
export function estadosDraw(_c: CanvasRenderingContext2D, d: Dungeon) {
  const h = d.hero,
    ativo = !!h && d.active && !d.training && !d.dead && !d.invOpen && !d.modalOpen,
    lista = ativo ? estadosDe(h!, true) : [],
    A = anelHeroi(d),
    p = ativo ? naTela(A.x, A.y) : null,
    cv = TELAS.dCanvas,
    k = p && cv ? (cv.getBoundingClientRect().width / (D3.on ? D3.cw || 1 : d.cols * d.tile)) * (D3.on ? D3.s : 1) : 1,
    rTela = A.r * k; // o raio do anel na tela
  // dentro do anel: um por vez (os de combate em roda; os outros de lembrete)
  const anel = camada("est-anel"),
    eAnel = ativo && p && OPT.estAnel ? doAnel(lista, performance.now()) : null;
  anel.classList.toggle("on", !!eAnel);
  if (eAnel && p) {
    const html = seloHtml(eAnel);
    if (anel.dataset.html !== html) {
      anel.dataset.html = html;
      anel.innerHTML = html;
    }
    anel.style.left = p.x + "px";
    anel.style.top = p.y + "px";
    anel.style.setProperty("--d", Math.max(16, rTela * 1.25).toFixed(1) + "px");
  }
  // selos em volta do anel, o mais grave primeiro
  const selos = camada("est-selos"),
    lsSelos = ativo && p && OPT.estSelos ? lista.slice(0, ESTADOS_UI.selos) : [];
  selos.classList.toggle("on", lsSelos.length > 0);
  if (lsSelos.length && p) {
    const html = lsSelos.map(seloHtml).join("");
    if (selos.dataset.html !== html) {
      selos.dataset.html = html;
      selos.innerHTML = html;
    }
    const angulos = [-1.2, -0.35, 0.5],
      R = rTela + 13;
    lsSelos.forEach((_e, i) => {
      const s = selos.children[i] as HTMLElement | undefined;
      if (!s) return;
      s.style.left = p.x + Math.cos(angulos[i]) * R + "px";
      s.style.top = p.y + Math.sin(angulos[i]) * R + "px";
    });
  }
  fita(ativo && OPT.estFita ? lista : null);
}

/** Um ponto do campo (px do campo) na tela (px da janela). v8.1: o craft rápido também usa (field/craft_rapido.ts). */
export function naTela(x: number, y: number) {
  const cv = TELAS.dCanvas;
  if (!cv) return null;
  const r = cv.getBoundingClientRect(),
    d = dungeon;
  if (!D3.on) return { x: r.left + (x * r.width) / (d.cols * d.tile), y: r.top + (y * r.height) / (d.rows * d.tile) };
  return {
    x: r.left + ((D3.cw / 2 + (x - D3.cx) * D3.s) * r.width) / (D3.cw || 1),
    y: r.top + ((D3.ch / 2 + D3.vy + (y - D3.cz) * D3.SIN! * D3.s) * r.height) / (D3.ch || 1),
  };
}

/** A fita sob os pés (HTML por cima do campo): os ícones com a barrinha; clicar abre o painel. */
function fita(lista: EstadoHeroi[] | null) {
  const d = dungeon;
  let el = document.getElementById("est-fita");
  if (!lista || !lista.length || d.invOpen || d.modalOpen) {
    if (el) el.classList.remove("on");
    return;
  }
  if (!el) {
    el = document.createElement("button");
    el.id = "est-fita";
    (el as HTMLButtonElement).type = "button";
    el.title = "Ver todos os efeitos e as necessidades";
    el.addEventListener("pointerdown", (e) => e.stopPropagation()); // não vira ataque nem mira no campo
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      alternarPainel(dungeon.hero);
    });
    document.getElementById("dungeon-view")?.appendChild(el);
  }
  const assinatura = lista.map((e) => e.id + ":" + e.nivel).join(",");
  if (el.dataset.ass !== assinatura) {
    el.dataset.ass = assinatura;
    el.innerHTML = lista.map((e) => '<span class="est-i ' + e.nivel + '">' + e.ico + "<i><b></b></i></span>").join("");
  }
  lista.forEach((e, i) => {
    const b = el!.children[i]?.querySelector("b");
    if (b) b.style.width = Math.round(e.frac * 100) + "%";
  });
  const p = naTela(d.px, d.py + d.tile * 0.6);
  if (p) {
    el.style.left = p.x + "px";
    el.style.top = p.y + "px";
  }
  el.classList.add("on");
}

/* ---------- o painel: tudo o que está valendo e as necessidades ---------- */
const PAINEL = { h: null as Hero | null, timer: 0 };

/** Abre o painel de `h` (fita, ou selo de um cartão do clã); de novo no mesmo, fecha. */
export function alternarPainel(h: Hero | null | undefined) {
  const el = document.getElementById("est-painel");
  if (!h || (el && el.classList.contains("on") && PAINEL.h === h)) {
    fecharPainel();
    return;
  }
  PAINEL.h = h;
  desenharPainel();
  document.getElementById("est-painel")!.classList.add("on");
  if (!PAINEL.timer) PAINEL.timer = window.setInterval(desenharPainel, 500);
}
function fecharPainel() {
  document.getElementById("est-painel")?.classList.remove("on");
  PAINEL.h = null;
  if (PAINEL.timer) clearInterval(PAINEL.timer);
  PAINEL.timer = 0;
}
function desenharPainel() {
  const h = PAINEL.h;
  if (!h) return;
  let el = document.getElementById("est-painel");
  if (!el) {
    el = document.createElement("div");
    el.id = "est-painel";
    el.setAttribute("role", "dialog");
    el.addEventListener("pointerdown", (e) => e.stopPropagation());
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if ((e.target as HTMLElement).closest("[data-fechar]")) fecharPainel();
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && PAINEL.h) fecharPainel();
    });
    document.body.appendChild(el);
  }
  const lista = estadosDe(h),
    problemas = lista.filter((e) => e.nivel !== "bonus"),
    bonus = lista.filter((e) => e.nivel === "bonus"),
    linha = (e: EstadoHeroi) =>
      '<div class="est-ef"><span class="est-ic ' +
      e.nivel +
      '">' +
      e.ico +
      "</span><b>" +
      e.nome +
      '</b><span class="est-v">' +
      e.valor +
      "</span><small>" +
      e.efeito +
      "</small></div>",
    barra = (rot: string, pct: number, cor: string, txt: string) =>
      '<div class="est-nec"><span>' +
      rot +
      '</span><span class="est-b"><i style="width:' +
      Math.round(Math.max(0, Math.min(100, pct))) +
      "%;background:" +
      cor +
      '"></i></span><span class="est-v">' +
      txt +
      "</span></div>",
    L = ESTADOS_LIM,
    fome = h.hunger || 0,
    frio = h.cold || 0,
    carga = loadK(h),
    corDe = (v: number, lim: { alerta: number; perigo: number }) =>
      v > lim.perigo ? COR.perigo : v > lim.alerta ? COR.alerta : "#55d878";
  const html =
    "<header><h3>" +
    h.name +
    '</h3><button type="button" data-fechar="1" aria-label="Fechar">✕</button></header><div class="est-cols"><div><h4>Problemas</h4>' +
    (problemas.length ? problemas.map(linha).join("") : '<p class="est-vazio">Nada atrapalhando agora.</p>') +
    "</div><div><h4>Bônus</h4>" +
    (bonus.length
      ? bonus.map(linha).join("")
      : '<p class="est-vazio">Nenhum bônus agora. Comida boa e descanso vão dar bônus aqui.</p>') +
    "<h4>Necessidades</h4>" +
    barra("🍖 Fome", fome, corDe(fome, L.fome), Math.round(fome) + "%") +
    '<div class="est-nec"><span>🌡 Corpo</span><span class="est-b est-temp"><i style="left:' +
    Math.round(50 - frio / 2) +
    '%"></i></span><span class="est-v">' +
    (frio > L.frio.perigo ? "gelado" : frio > L.frio.alerta ? "frio" : frio > 20 ? "fresco" : "bem") +
    "</span></div>" +
    barra("🎒 Carga", (carga / 1.5) * 100, corDe(carga, L.carga), Math.round(carga * 100) + "%") +
    "</div></div>";
  if (el.dataset.html !== html) {
    el.dataset.html = html;
    el.innerHTML = html;
  }
}
