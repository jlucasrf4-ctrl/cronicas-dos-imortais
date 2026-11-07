/* ==== v8.1 — Perigo: alguém do clã, trabalhando sozinho no mapa, encontrou uma Runa Selvagem ou bandidos ====
   (mantenedor, 2026-10-30/31: "aparece uma mensagem X está em perigo, leva a câmera até ele no modo mapa, vai ter a
   opção chamar reforços e quem vai ou todo mundo; sempre que achar uma runa natural seja uma boss fight difícil com 30%
   de chance de sucesso"; bandidos: "no campo a maioria das vezes, mas também quem trabalha sozinho à noite, mas sempre
   avisar que vai ter pagode, igual na runa selvagem: entra no modo jogo com os bandidos e um contador com ajuda a
   caminho".) A exceção ao "o jogo nunca te puxa" (map/cacada.ts).
   · O mapa (perigoTick, a cada tique da simulação): um bicho rúnico perto de quem trabalha sozinho, ou (à noite, uma
     vez por noite) um bando de bandidos → o jogo pausa, a câmera vai até ela e abre o painel (#perigo): quem pode ir
     ajudar (com o tempo de chegada), Lutar ou Deixar (os bandidos: também Entregar o ouro).
   · No campo, à noite (perigoCampoTick): uma vez por noite, com BANDO_NOITE.campo de chance, um bando chega; o campo
     pausa e o mesmo painel abre (Enfrentar ou Entregar o ouro).
   · Deixar: a luta se resolve sozinha quando o reforço mais lento chega (ou em PERIGO.deixarMin), com a chance de
     sozinha mais a de cada reforço.
   · Lutar: entra no campo com ela; o bicho vira chefe (o lobo ou o javali do campo, mais forte, com a aura do elemento;
     coelho e cervo lutam como lobo com o próprio modelo: Monster.visualBicho) ou o bando chega (field/bandidos.ts). No
     alto, "ajuda a caminho" contando; quando zera, os reforços chegam e atiram flechas (até aliados lutarem junto,
     ROADMAP). Sair antes do fim conta como deixar resolver.
   · Derrota: ela não morre; volta ferida ao acampamento (os bandidos levam parte do ouro). Vitória: a runa bruta e
     experiência; dos bandidos, o saque. ==== */
import { camera, dungeon, econ, world } from "../core/state.ts";
import { CONFIG } from "../core/config.ts";
import { PERIGO } from "../data/perigo.ts";
import { BANDO, BANDO_NOITE } from "../data/bandidos.ts";
import { HERO_SPEED, HERO_STATE_LABEL } from "../data/herois.ts";
import { RUNE_EL, RUNIC_NAME } from "../data/runas.ts";
import { SPECIES } from "../data/especies.ts";
import { ITEM_DEFS } from "../data/itens.ts";
import { camZoomTo } from "../survival/acampamento.ts";
import { mapZoomLimit } from "../ui/modos.ts";
import { mvToast } from "../ui/avisos.ts";
import { updateHeroPanelUI } from "../ui/painel.ts";
import { pushEvent } from "../sim/eventos.ts";
import { killAnimal } from "../sim/animais.ts";
import { addHeroXp } from "../hero/nivel.ts";
import { tryAddItem } from "../field/chao.ts";
import { cineSfx } from "../audio/som.ts";
import { spawnDungeonMonster, setBanner, spawnDungeonToast } from "../field/masmorra.ts";
import { spawnJavalino } from "../creatures/javali.ts";
import { hurtMonster } from "../field/acertos.ts";
import { addRing } from "../field/chao.ts";
import { bandoChega, bandoNoCampo } from "../field/bandidos.ts";
import { ehNoite } from "../campanha/sono.ts";
import { ISC } from "../intro/cena.ts";
import { emCacada } from "./cacada.ts";
import { entrarNoCampo } from "./transicao.ts";
import { mapGoCamp } from "./controle.ts";
import { ligarBicho, pontoPerto } from "./mundo.ts";
import type { Animal, Hero, Monster } from "../core/tipos.ts";

/** Quem conta como "trabalhando sozinha" no mapa (fora do acampamento, fora do campo). */
const SOZINHA = ["hunting", "traveling", "returning", "field", "walking"];
/** Quem pode ir ajudar. */
const PODE_AJUDAR = ["idle", "hunting", "traveling", "returning", "field", "walking"];

interface Reforco {
  h: Hero;
  min: number; // minutos de jogo até chegar
}
interface Perigo {
  tipo: "runa" | "bandidos";
  h: Hero;
  alvo: Animal | null; // a runa: o bicho rúnico do mapa
  n: number; // os bandidos: quantos
  ang: number; // os bandidos: de onde vêm (rad, a partir dela no campo)
  noCampo: boolean; // começou com ela jogando no campo
  volta: { state: string; task: Hero["task"] };
  reforcos: Reforco[];
  resolveEm: number | null; // world.tick em que a luta deixada se resolve
  campo: {
    m: Monster | null;
    grupo: number | null;
    ajuda: number | null;
    chegou: boolean;
    flechaT: number;
  } | null;
}
const P = { atual: null as Perigo | null };
/** A noite no campo: qual é, se o bando vem e em quantos s. */
const NOITE_CAMPO = { noite: -1, vem: false, em: 0 };

const noiteAtual = () => Math.floor((world.tick - 6 * 60) / CONFIG.DAY_MIN);
const nomeBicho = (a: Animal) =>
  (RUNIC_NAME[a.species] || (SPECIES[a.species] ? SPECIES[a.species].label + " Rúnico" : "Runa Selvagem")) +
  " · " +
  (RUNE_EL[a.runic!]?.n || "Runa");
const nome = (A: Perigo) => (A.tipo === "runa" ? nomeBicho(A.alvo!) : A.n + " bandidos");
const chance = (A: Perigo, n: number) =>
  A.tipo === "runa"
    ? Math.min(PERIGO.maxChance, PERIGO.sozinho + PERIGO.porReforco * n)
    : Math.min(PERIGO.maxChance, BANDO_NOITE.sozinha + BANDO_NOITE.porReforco * n);
const minutos = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.max(1, Math.round(Math.hypot(a.x - b.x, a.y - b.y) / HERO_SPEED));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const tamanhoBando = () => Math.round(rnd(BANDO.tamanho[0] - 0.49, BANDO.tamanho[1] + 0.49));
const ouroLevado = () =>
  Math.min(econ.gold, Math.max(BANDO_NOITE.ouroMin, Math.round(econ.gold * BANDO_NOITE.ouroPerde)));

/** A cada tique da simulação do mapa (sim/motor.ts). */
export function perigoTick() {
  const A = P.atual;
  if (A) {
    // lutando: ela saiu do campo antes do fim (o tique do campo não roda mais): resolve como deixada
    if (A.campo && (A.campo.m || A.campo.grupo != null) && !(dungeon.active && dungeon.hero === A.h)) {
      const aindaLuta = A.campo.m ? A.campo.m.alive : bandoNoCampo(A.campo.grupo!);
      resolver(aindaLuta ? Math.random() < chance(A, A.reforcos.length) : true);
      return;
    }
    // a luta deixada se resolve na hora marcada; o bicho que morreu de outro jeito é vitória sem luta
    if (!A.campo && A.resolveEm != null && world.tick >= A.resolveEm)
      resolver(Math.random() < chance(A, A.reforcos.length));
    else if (!A.campo && A.alvo && A.alvo.alive === false) resolver(true);
    return;
  }
  // um save carregado no meio de um perigo: ela volta ao mapa
  for (const h of world.heroes) if (h.state === "perigo") h.state = "field";
  if (dungeon.active) return; // jogando no campo: o perigo espera ela voltar ao mapa (o bicho continua lá)
  for (const a of world.animals) {
    if (!a.alive || !a.runic || (a._perigoAte || 0) > world.tick) continue;
    const h = world.heroes.find((x) => SOZINHA.includes(x.state) && Math.hypot(x.x - a.x, x.y - a.y) < PERIGO.raio);
    if (h) {
      comecar({ tipo: "runa", h, alvo: a, n: 0 });
      return;
    }
  }
  // v8.1: os bandidos, à noite, em quem trabalha sozinha (uma vez por noite)
  if (ehNoite() && econ._bandidosNoite !== noiteAtual() && Math.random() < BANDO_NOITE.mapa) {
    const sos = world.heroes.filter((x) => SOZINHA.includes(x.state));
    if (sos.length) {
      econ._bandidosNoite = noiteAtual();
      comecar({ tipo: "bandidos", h: sos[Math.floor(Math.random() * sos.length)], alvo: null, n: tamanhoBando() });
    }
  }
}

function novoPerigo(o: { tipo: Perigo["tipo"]; h: Hero; alvo: Animal | null; n: number }, noCampo: boolean): Perigo {
  return {
    ...o,
    ang: Math.random() * Math.PI * 2,
    noCampo,
    volta: { state: o.h.state, task: o.h.task },
    reforcos: [],
    resolveEm: null,
    campo: null,
  };
}
function comecar(o: { tipo: Perigo["tipo"]; h: Hero; alvo: Animal | null; n: number }) {
  const h = o.h;
  if (o.alvo) o.alvo._perigoAte = world.tick + PERIGO.calma;
  const A = (P.atual = novoPerigo(o, false));
  HERO_STATE_LABEL.perigo = "⚠ Em perigo!";
  h.state = "perigo";
  h.walkTo = null;
  pausar(true);
  camZoomTo(h.x, h.y, Math.max(camera.scale, mapZoomLimit() * 2.2), 700);
  cineSfx("roar");
  pushEvent("⚠ " + h.name + " está em perigo: " + (A.tipo === "runa" ? "um " + nome(A) : nome(A) + " na noite") + "!");
  updateHeroPanelUI();
  abrirPainel();
}
/** v8.1 — o bando chegando com ela jogando no campo à noite: o campo pausa e o painel abre. */
function comecarNoCampo(h: Hero) {
  econ._bandidosNoite = noiteAtual();
  P.atual = novoPerigo({ tipo: "bandidos", h, alvo: null, n: tamanhoBando() }, true);
  dungeon.modalOpen = true;
  pausar(true);
  cineSfx("roar");
  pushEvent("⚠ Bandidos se aproximam de " + h.name + "!");
  abrirPainel();
}

function pausar(sim: boolean) {
  world.paused = sim;
  const b = document.getElementById("btn-pause");
  if (b) b.textContent = sim ? "▶ Continuar" : "⏸ Pausar";
}

/* ---------- o painel ---------- */
function abrirPainel() {
  const A = P.atual!,
    h = A.h,
    runa = A.tipo === "runa",
    E = runa ? RUNE_EL[A.alvo!.runic!] : null,
    livres = world.heroes.filter((x) => x !== h && PODE_AJUDAR.includes(x.state)),
    leva = ouroLevado();
  let el = document.getElementById("perigo");
  if (!el) {
    el = document.createElement("div");
    el.id = "perigo";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    document.body.appendChild(el);
    el.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-todos]"))
        for (const c of el!.querySelectorAll<HTMLInputElement>("input[data-ref]")) c.checked = true;
      const b = t.closest<HTMLElement>("[data-acao]");
      if (b) escolher(b.dataset.acao!);
      if (t.closest("input[data-ref],[data-todos]")) atualizarChance();
    });
  }
  const texto = runa
    ? 'Um <b style="color:' +
      (E?.c || "#ffd27a") +
      '">' +
      nome(A) +
      "</b> apareceu: um bicho que tocou uma Runa Natural. É uma luta difícil."
    : "<b>" +
      A.n +
      " bandidos</b> " +
      (A.noCampo ? "estão chegando, vindos " + rumo(A.ang) : "cercaram " + h.name + " na noite") +
      (leva > 0 ? ". Dá para enfrentar, ou entregar o ouro (levam " + leva + "💰)." : ". Sem ouro para entregar.");
  const acoes = A.noCampo
    ? '<button type="button" class="pg-b pri" data-acao="lutar">⚔ Enfrentar</button>'
    : '<button type="button" class="pg-b pri" data-acao="lutar">⚔ Lutar com ' +
      h.name +
      '</button><button type="button" class="pg-b" data-acao="deixar">🎲 Deixar resolver</button>';
  el.innerHTML =
    '<div class="pg-card"><div class="pg-alerta">⚠ ' +
    (runa ? "Perigo" : "Bandidos") +
    "</div><h2>" +
    h.name +
    " está em perigo!</h2><p>" +
    texto +
    "</p>" +
    (A.noCampo
      ? ""
      : '<div class="pg-chance">Sozinha: <b>' +
        Math.round(chance(A, 0) * 100) +
        '%</b> de vencer · <span id="pg-chance"></span></div>') +
    "<h3>Chamar reforços</h3>" +
    (livres.length
      ? '<div class="pg-lista">' +
        livres
          .map(
            (r) =>
              '<label><input type="checkbox" data-ref="' +
              r.id +
              '"> <b>' +
              r.name +
              "</b> <small>chega em ~" +
              minutos(r, h) +
              " min</small></label>",
          )
          .join("") +
        '</div><button type="button" class="pg-todos" data-todos="1">Marcar todos</button>'
      : '<p class="pg-vazio">Ninguém livre para ir ajudar agora.</p>') +
    '<div class="pg-acoes">' +
    acoes +
    (runa || leva <= 0 ? "" : '<button type="button" class="pg-b" data-acao="ouro">💰 Entregar o ouro</button>') +
    "</div></div>";
  el.classList.add("on");
  atualizarChance();
  el.querySelector<HTMLElement>("[data-acao=lutar]")?.focus();
}
/** De onde vêm (o ângulo do campo: x para o leste, y para o sul). */
function rumo(a: number) {
  const n = ["do leste", "do sudeste", "do sul", "do sudoeste", "do oeste", "do noroeste", "do norte", "do nordeste"];
  return n[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}
function marcados() {
  const ids = [...document.querySelectorAll<HTMLInputElement>("#perigo input[data-ref]:checked")].map(
    (c) => c.dataset.ref,
  );
  return world.heroes.filter((x) => ids.includes(x.id));
}
function atualizarChance() {
  const A = P.atual,
    n = marcados().length,
    el = document.getElementById("pg-chance");
  if (el && A)
    el.innerHTML = n
      ? "com " + n + " reforço" + (n > 1 ? "s" : "") + ": <b>" + Math.round(chance(A, n) * 100) + "%</b>"
      : "cada reforço soma " + Math.round((A.tipo === "runa" ? PERIGO.porReforco : BANDO_NOITE.porReforco) * 100) + "%";
}
function fecharPainel() {
  document.getElementById("perigo")?.classList.remove("on");
}

function escolher(acao: string) {
  const A = P.atual;
  if (!A) return;
  const h = A.h;
  fecharPainel();
  pausar(false);
  if (A.noCampo) dungeon.modalOpen = false;
  if (acao === "ouro") {
    // os bandidos levam parte do ouro e vão embora
    const leva = ouroLevado();
    econ.gold -= leva;
    pushEvent("💰 " + h.name + " entregou " + leva + " de ouro aos bandidos.");
    mvToast("💰 Os bandidos levaram " + leva + " de ouro e foram embora");
    P.atual = null;
    if (!A.noCampo && h.state === "perigo") {
      h.state = A.volta.task ? A.volta.state : "field";
      h.task = A.volta.task;
    }
    updateHeroPanelUI();
    return;
  }
  // os reforços saem andando até ela
  A.reforcos = marcados().map((r) => {
    const min = minutos(r, h);
    r.walkTo = { x: h.x, y: h.y };
    r.task = null;
    r.state = "walking";
    r._enterCamp = false;
    return { h: r, min };
  });
  if (A.reforcos.length) pushEvent("📣 " + A.reforcos.map((r) => r.h.name).join(", ") + " foi ajudar " + h.name + ".");
  const lento = A.reforcos.reduce((m, r) => Math.max(m, r.min), 0);
  if (acao === "deixar") {
    A.resolveEm = world.tick + Math.max(PERIGO.deixarMin, lento);
    mvToast(
      "🎲 " + h.name + " enfrenta " + nome(A) + ": " + Math.round(chance(A, A.reforcos.length) * 100) + "% de vencer",
    );
    updateHeroPanelUI();
    return;
  }
  // lutar: entra no campo com ela (se já não está); o chefe ou o bando aparece quando o campo abrir
  A.campo = {
    m: null,
    grupo: null,
    ajuda: lento ? Math.max(PERIGO.ajudaMin, Math.min(PERIGO.ajudaMax, lento * PERIGO.segPorMin)) : null,
    chegou: false,
    flechaT: 0,
  };
  if (A.noCampo) {
    bandoNoCampoChega();
    return;
  }
  h.state = "field";
  entrarNoCampo(h);
  let n = 0;
  const esperar = () => {
    const d = dungeon;
    if (d.active && d.origem && d.hero === h) (A.tipo === "runa" ? chefeNoCampo : bandoNoCampoChega)();
    else if (n++ < 60) setTimeout(esperar, 150);
    else resolver(Math.random() < chance(A, A.reforcos.length)); // o campo não abriu: resolve como deixada
  };
  setTimeout(esperar, 300);
}

/* ---------- no campo ---------- */
function chefeNoCampo() {
  const A = P.atual;
  if (!A || !A.campo || A.campo.m || !A.alvo) return;
  const a = A.alvo,
    E = RUNE_EL[a.runic!],
    m = a.species === "boar" ? spawnJavalino(1) : spawnDungeonMonster({ hpMult: 1 });
  const p = pontoPerto(5, 7);
  if (p) ({ x: m.x, y: m.y } = p);
  m.hpMax = Math.round(m.hpMax * PERIGO.chefeVida);
  m.hp = m.hpMax;
  m.dm = (m.dm || 1) * PERIGO.chefeDano;
  m.runic = a.runic;
  m.name = nomeBicho(a);
  m.neutral = false;
  if (a.species === "rabbit" || a.species === "deer") {
    // luta como lobo, com o próprio modelo (render/gl/renderer.ts glWolf)
    m.visualBicho = true;
    m.sp = a.species;
    m.sex = a.sex;
  }
  ligarBicho(m, a); // derrubado no campo, morre no mapa (map/mundo.ts)
  dungeon.foco = m;
  A.campo.m = m;
  addRing(m.x, m.y, E?.c || "#ffd27a", 80, 0.8, 4);
  setBanner(
    "✨ " + m.name,
    A.campo.ajuda ? "luta difícil · a ajuda está a caminho" : "luta difícil · ninguém vem ajudar",
    4,
    E?.c || "#ffd27a",
  );
}
/** v8.1 — o bando chega (field/bandidos.ts), de BANDO_NOITE.chegam tiles. */
function bandoNoCampoChega() {
  const A = P.atual;
  if (!A || !A.campo || A.campo.grupo != null) return;
  A.campo.grupo = bandoChega(A.n, A.ang, BANDO_NOITE.chegam);
  cineSfx("roar");
  setBanner(
    "⚠ Bandidos!",
    A.n + " vindo " + rumo(A.ang) + (A.campo.ajuda ? " · a ajuda está a caminho" : " · ninguém vem ajudar"),
    4,
    "#ff8a6a",
  );
}

/** Tique do campo (updateDungeonFlow): os bandidos da noite, o contador da ajuda, as flechas dos reforços e o fim. */
export function perigoCampoTick(dt: number) {
  const A = P.atual,
    C = A && A.campo;
  if (!A) noiteNoCampo(dt);
  if (!A || !C) return hud(null);
  const d = dungeon;
  if (!d.active || d.hero !== A.h) return hud(null); // a saída antes do fim, o tique do mapa resolve (perigoTick)
  if (!C.m && C.grupo == null) return;
  const acabou = C.m ? !C.m.alive : !bandoNoCampo(C.grupo!);
  if (acabou) {
    resolver(true);
    return hud(null);
  }
  if (C.ajuda != null && !C.chegou) {
    C.ajuda -= dt;
    if (C.ajuda <= 0) {
      C.chegou = true;
      spawnDungeonToast("🛡 " + A.reforcos.map((r) => r.h.name).join(", ") + " chegou!", d.px, d.py - 50, "#9fe3ff", 14);
      setBanner(
        "🛡 A ajuda chegou",
        A.tipo === "runa" ? "os reforços atiram no chefe" : "os reforços atiram nos bandidos",
        2.5,
        "#9fe3ff",
      );
    }
  }
  if (C.chegou) {
    C.flechaT -= dt;
    const alvo = C.m ?? maisPerto(C.grupo!);
    if (C.flechaT <= 0 && alvo) {
      C.flechaT = PERIGO.flechaCada / Math.max(1, A.reforcos.length);
      hurtMonster(alvo, PERIGO.flechaDano, "arco", 0, true);
      addRing(alvo.x, alvo.y, "#9fe3ff", 20, 0.25, 2);
      spawnDungeonToast("🏹", alvo.x, alvo.y - 30, "#9fe3ff", 13);
    }
  }
  hud(C.chegou ? "🛡 A ajuda chegou" : C.ajuda != null ? "🛡 Ajuda a caminho · " + relogio(C.ajuda) : "⚠ Sozinha");
}
function maisPerto(g: number) {
  const d = dungeon;
  let m: Monster | null = null,
    bd = Infinity;
  for (const o of d.monsters)
    if (o.alive && o.bandido && o.grupo === g && !o.bFoge) {
      const q = Math.hypot(o.x - d.px, o.y - d.py);
      if (q < bd) {
        bd = q;
        m = o;
      }
    }
  return m;
}
/** v8.1 — jogando no campo aberto à noite: uma vez por noite, com BANDO_NOITE.campo de chance, um bando chega depois
    de BANDO_NOITE.campoAtraso s. */
function noiteNoCampo(dt: number) {
  const d = dungeon,
    h = d.hero;
  if (!h || !d.origem || d.mode !== "campo" || d.training || d.camp || d.vila || d.dead || ISC.on || !ehNoite()) return;
  if (emCacada()) return; // o mergulho de uma caçada é curto e tem o próprio objetivo
  const noite = noiteAtual();
  if (econ._bandidosNoite === noite) return;
  if (NOITE_CAMPO.noite !== noite) {
    NOITE_CAMPO.noite = noite;
    NOITE_CAMPO.vem = Math.random() < BANDO_NOITE.campo;
    NOITE_CAMPO.em = rnd(...BANDO_NOITE.campoAtraso);
    if (!NOITE_CAMPO.vem) econ._bandidosNoite = noite;
    return;
  }
  if (d.modalOpen || d.invOpen || d.craftOpen || d.finish) return;
  if ((NOITE_CAMPO.em -= dt) <= 0) comecarNoCampo(h);
}
const relogio = (s: number) =>
  Math.floor(Math.max(0, s) / 60) + ":" + String(Math.ceil(Math.max(0, s) % 60)).padStart(2, "0");
function hud(txt: string | null) {
  let el = document.getElementById("perigo-hud");
  if (!txt) {
    if (el) el.classList.remove("on");
    return;
  }
  if (!el) {
    el = document.createElement("div");
    el.id = "perigo-hud";
    document.getElementById("dungeon-view")?.appendChild(el);
  }
  if (el.textContent !== txt) el.textContent = txt;
  el.classList.add("on");
}

/* ---------- o fim ---------- */
function resolver(venceu: boolean) {
  const A = P.atual;
  if (!A) return;
  P.atual = null;
  fecharPainel();
  hud(null);
  const h = A.h,
    n = nome(A),
    noCampo = dungeon.active && dungeon.hero === h;
  if (venceu) {
    if (A.tipo === "runa") {
      if (A.alvo && A.alvo.alive !== false) killAnimal(A.alvo, "Runa Selvagem derrotada");
      addHeroXp(h, 40);
      const runa = ITEM_DEFS.runa_bruta && tryAddItem(h, "runa_bruta");
      pushEvent("✨ " + h.name + " venceu o " + n + (runa ? " e ficou com uma runa bruta." : "."));
      mvToast("✨ " + h.name + " venceu o " + n + "!");
    } else if (A.campo && A.campo.grupo != null && noCampo) {
      // no campo o saque já caiu de cada um (field/bandidos.ts)
      pushEvent("⚔ " + h.name + " pôs os bandidos para correr.");
      setBanner("⚔ Os bandidos se foram", "", 3, "#ffe08a");
    } else {
      const ouro = Math.round(rnd(...BANDO_NOITE.ouroGanha));
      econ.gold += ouro;
      addHeroXp(h, 20);
      pushEvent("⚔ " + h.name + " venceu os bandidos e ficou com " + ouro + " de ouro.");
      mvToast("⚔ " + h.name + " venceu os bandidos! 💰 +" + ouro);
    }
    if (!noCampo && h.state === "perigo") {
      h.state = A.volta.task ? A.volta.state : "field";
      h.task = A.volta.task;
    }
  } else {
    // ela não morre: volta ferida ao acampamento; o bicho foge para longe; os bandidos levam parte do ouro
    h.hp = Math.max(1, Math.round((h.hpMax || 50) * PERIGO.vidaDerrota));
    h.wound = Math.max(h.wound || 0, Math.round((h.hpMax || 50) * PERIGO.feridaDerrota));
    let extra = "";
    if (A.alvo) {
      A.alvo.x += (Math.random() - 0.5) * 120;
      A.alvo.y += (Math.random() - 0.5) * 120;
    } else {
      const leva = ouroLevado();
      econ.gold -= leva;
      extra = " Levaram " + leva + " de ouro.";
    }
    pushEvent(
      "🩹 " + h.name + " perdeu para " + (A.alvo ? "o " : "os ") + n + " e voltou ferida ao acampamento." + extra,
    );
    mvToast("🩹 " + h.name + " perdeu para " + (A.alvo ? "o " : "os ") + n + ": voltando ferida ao acampamento");
    if (!noCampo) {
      h.state = "field";
      h.task = null;
      mapGoCamp(h);
    }
  }
  updateHeroPanelUI();
}
