/* ==== Fase 4 — tela de título, menu do jogo e inicialização (base/18) ==== */
import { prep, updateEcon } from "../econ/economia.ts";
import { sheet } from "./ficha.ts";
import { MV_VER, optApply } from "./opcoes.ts";
import { SAVE_SLOTS, latestSlot, slotMeta, loadFrom, autosaveTick } from "../save/salvar.ts";
import { audioCtx, musicStart, musicStop } from "../audio/som.ts";
import { world, SOM, JANELAS, TELAS, MEMO, econ, dungeon, SEL } from "../core/state.ts";
import { limparSelecao } from "../map/selecao.ts";
import { cacadaDispensar } from "../map/cacada.ts";
import { sfx } from "../field/chao.ts";
import { openSlots, openOptions, mvPanel, mvClose } from "./paineis.ts";
import { mvToast } from "./avisos.ts";
import { hudUpdate, hudBuild } from "./hud.ts";
import { openCreateModal } from "./criacao.ts";
import { QUAD, quadSetBounds, quadOf, quadTick } from "../map/quadrantes.ts";
import { SPAWN0, CONFIG } from "../core/config.ts";
import { WORLD_K } from "../map/vetorial.ts";
import { buildWaterGrid } from "../map/agua.ts";
import { updateHeroPanelUI } from "./painel.ts";
import { pushEvent } from "../sim/eventos.ts";
import { resetWorld } from "./janelas.ts";
import { fitToScreen } from "../map/camera.ts";
import { playIntro, INTRO, introSkip, introNext } from "../intro/cinematica.ts";
import { VOIDD } from "../intro/voidd.ts";
import { fmtClock } from "../core/util.ts";
import type { Econ } from "../core/tipos.ts";

/* ---------- tela de título ---------- */
/** v7.7 — arte da tela de título (tools/gerar-titulo.ts, plano tools/modelos/titulo.json): o fundo e onde ficam nele,
    em % da imagem, os pontos que ganham efeito (a ponta da torre pulsa, o corpo brilha devagar, o reflexo do lago
    cintila). `foco` = % x da torre: o corte do fundo (cover) segue a torre quando a tela é estreita.
    Fundo alternativo: "/src/assets/art/titulo_torre.webp" (foco 71, farol [71.5, 0], torre [71.6, 32], lago [75, 85]). */
const TITULO_ARTE = {
  fundo: "/src/assets/art/titulo_cidadela.webp",
  logo: "/src/assets/art/titulo_logo.webp",
  selo: "/src/assets/art/titulo_selo.webp",
  foco: 72,
  farol: [72.6, 2],
  torre: [72.3, 40],
  lago: [77, 85],
};
export const TS = {
  open: false,
  fx: null as null,
  parts: [] as { x: number; y: number; vx: number; vy: number; r: number; l: number; L: number; v: boolean }[],
  raf: 0,
  sel: 0,
};

export function anyGameModal() {
  return (
    !!document.querySelector(
      ".mv-panel.open, #create-modal.open, #log-modal.open, .v3-modal.open, #sheet-modal.open",
    ) ||
    (typeof prep !== "undefined" && prep.open) ||
    (typeof sheet !== "undefined" && sheet.open)
  );
}

function tsBuild() {
  const el = document.createElement("div");
  el.id = "title-screen";
  // v7.7: arte do GPT (TITULO_ARTE): fundo com efeitos em CSS (31_v7.7_tela_de_titulo.css), título em imagem, selo
  // VOIDD; o #ts-map fica (map/vetorial.ts o atualiza), escondido pelo CSS
  const A = TITULO_ARTE,
    pct = (n: string, p: number[]) => `--${n}x:${p[0]}%;--${n}y:${p[1]}%`;
  el.innerHTML =
    `<div id="ts-arte" style="--foco:${A.foco / 100};${pct("f", A.farol)};${pct("t", A.torre)};${pct("l", A.lago)}">` +
    `<div id="ts-zoom"><img id="ts-fundo" src="${A.fundo}" alt=""><i class="ts-luz ts-torre"></i><i class="ts-luz ts-farol"></i>` +
    '<i class="ts-lago"></i><i class="ts-nevoa"></i><i class="ts-nevoa ts-n2"></i></div></div>' +
    '<img id="ts-map" alt=""><div id="ts-shade"></div><canvas id="ts-fx"></canvas><div id="ts-center"><div id="ts-logo">' +
    `<h1><img id="ts-titulo" src="${A.logo}" alt="Crônicas dos Imortais"></h1></div>` +
    '<div id="ts-press">Clique ou pressione qualquer tecla</div><nav id="ts-menu"></nav></div>' +
    `<div id="ts-voidd"><img src="${A.selo}" alt="Voidd World"><span>WORLD</span></div><div id="ts-foot">` +
    MV_VER +
    " · um mundo vivo de baixa magia · as escolhas ficam salvas neste navegador</div>";
  document.body.appendChild(el);
  const mi = document.getElementById("map-img") as HTMLImageElement;
  if (mi) (el.querySelector("#ts-map") as HTMLImageElement).src = mi.src;
  el.addEventListener("pointerdown", (e) => {
    if (!el.classList.contains("menu")) {
      tsWake();
      e.preventDefault();
    }
  });
  el.querySelector("#ts-menu")!.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b || b.disabled) return;
    tsAct(b.dataset.act!);
  });
  el.querySelector("#ts-menu")!.addEventListener("mousemove", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (b && !b.disabled) {
      TS.sel = [...el.querySelectorAll(".ts-btn")].indexOf(b);
      tsSel();
    }
  });
}
function tsMenu() {
  const last = latestSlot(),
    m = last ? slotMeta(last) : null,
    any = SAVE_SLOTS.some((s) => slotMeta(s));
  document.getElementById("ts-menu")!.innerHTML =
    (last
      ? '<button class="ts-btn" data-act="continue">Continuar<small>Dia ' +
        m.day +
        " · " +
        (m.heroes[0] || "sem heróis") +
        (m.heroes.length > 1 ? " +" + (m.heroes.length - 1) : "") +
        "</small></button>"
      : "") +
    '<button class="ts-btn" data-act="new">Novo Jogo</button>' +
    '<button class="ts-btn" data-act="load"' +
    (any ? "" : " disabled") +
    ">Carregar</button>" +
    '<button class="ts-btn" data-act="options">Opções</button>';
  TS.sel = 0;
  tsSel();
}
function tsSel() {
  const bs = [...document.querySelectorAll("#ts-menu .ts-btn")];
  bs.forEach((b, i) => b.classList.toggle("sel", i === TS.sel));
}
function tsWake() {
  const el = document.getElementById("title-screen")!;
  if (el.classList.contains("menu")) return;
  el.classList.add("menu");
  tsMenu();
  audioCtx();
  musicStart("calm");
}
export function openTitle() {
  TS.open = true;
  world.paused = true;
  const el = document.getElementById("title-screen")!;
  el.classList.add("open");
  el.classList.add("menu"); // o menu fica pronto por baixo da abertura interativa
  tsMenu();
  if (SOM._ac) {
    musicStart("calm");
  }
  document.getElementById("app")!.classList.add("ts-behind");
  cancelAnimationFrame(TS.raf);
  TS.raf = requestAnimationFrame(tsFx);
}
export function closeTitle() {
  TS.open = false;
  document.getElementById("title-screen")!.classList.remove("open");
  cancelAnimationFrame(TS.raf);
  document.getElementById("app")!.classList.remove("ts-behind");
}
function tsAct(a: string) {
  sfx("ping");
  if (a === "continue") {
    const s = latestSlot();
    if (s && loadFrom(s)) enterGame();
  } else if (a === "new") startNewGame();
  else if (a === "load")
    openSlots("load", (r?: string) => {
      if (r === "loaded") enterGame();
    });
  else if (a === "options") openOptions();
}
export function enterGame(fresh?: boolean) {
  closeTitle();
  musicStop(2);
  world.paused = false;
  const pb = document.getElementById("btn-pause");
  if (pb) pb.textContent = "⏸ Pausar";
  hudUpdate();
  JANELAS._autoT = 0;
  if (fresh)
    setTimeout(() => {
      if (!world.heroes.length) {
        openCreateModal();
        mvToast("✨ Crie o primeiro imortal da sua crônica");
      }
    }, 400);
}
export function startNewGame() {
  closeTitle();
  musicStop(1.5);
  // mundo novo: ecossistema reiniciado, sem heróis, economia do zero
  world.heroes = [];
  QUAD.store = {};
  world.qstore = QUAD.store;
  QUAD.active = null;
  quadSetBounds(quadOf(SPAWN0.x * WORLD_K, SPAWN0.y * WORLD_K));
  buildWaterGrid(TELAS.mapImg);
  resetWorld();
  world.events = [];
  const e0 = JSON.parse(JSON.stringify(MEMO.ECON0));
  for (const k of Object.keys(econ) as (keyof Econ)[]) delete econ[k];
  Object.assign(econ, e0);
  updateHeroPanelUI();
  updateEcon();
  fitToScreen();
  world.paused = true;
  playIntro(() => {
    pushEvent("Ninguém sabe ao certo como começou: as runas antigas voltaram a brilhar.");
    pushEvent("Rumores: um coelho foi visto se transformando em fera perto de uma pedra rúnica.");
    enterGame(true);
  });
}
function tsFx(now: number) {
  // brasas subindo (v7.7: douradas e roxas; o anel rúnico saiu, a arte do fundo já tem o portal)
  if (!TS.open) return;
  TS.raf = requestAnimationFrame(tsFx);
  const cv = document.getElementById("ts-fx") as HTMLCanvasElement,
    dpr = Math.min(2, window.devicePixelRatio || 1),
    W = cv.clientWidth,
    H = cv.clientHeight;
  if (cv.width !== Math.round(W * dpr)) {
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
  }
  const c = cv.getContext("2d")!;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, W, H);
  const t = now / 1000;
  if (TS.parts.length < 70 && Math.random() < 0.5)
    TS.parts.push({
      x: Math.random() * W,
      y: H + 10,
      vx: (Math.random() - 0.5) * 12,
      vy: -(18 + Math.random() * 40),
      r: 0.8 + Math.random() * 2,
      l: 0,
      L: 5 + Math.random() * 6,
      v: Math.random() < 0.35, // v7.7: mais brasas roxas (o portal do fundo)
    });
  c.globalCompositeOperation = "lighter";
  for (let i = TS.parts.length - 1; i >= 0; i--) {
    const p = TS.parts[i];
    p.l += 1 / 60;
    if (p.l > p.L) {
      TS.parts.splice(i, 1);
      continue;
    }
    p.x += (p.vx + Math.sin(t + i) * 6) / 60;
    p.y += p.vy / 60;
    const a = Math.sin((Math.PI * p.l) / p.L) * 0.9,
      g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
    g.addColorStop(0, p.v ? "rgba(200,160,255," + a + ")" : "rgba(255,190,90," + a + ")");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.fillRect(p.x - p.r * 5, p.y - p.r * 5, p.r * 10, p.r * 10);
  }
  c.globalCompositeOperation = "source-over";
}

/* ---------- menu do jogo (Esc / ☰) ---------- */
export function openGameMenu() {
  if (TS.open || dungeon.active) return;
  const p = mvPanel("mv-game"),
    card = p.querySelector(".mv-card") as HTMLElement;
  JANELAS._gmPaused = world.paused;
  world.paused = true;
  p._onClose = () => {
    world.paused = JANELAS._gmPaused;
  };
  card.innerHTML =
    '<h2>⏸ Jogo pausado</h2><div class="mv-sub">Dia ' +
    (Math.floor(world.tick / CONFIG.DAY_MIN) + 1) +
    " · " +
    fmtClock(world.tick) +
    '</div><div style="display:flex;flex-direction:column;gap:7px;align-items:stretch;margin-top:6px">' +
    [
      '<button class="mv-b pri" data-g="resume">▶ Continuar</button>',
      '<button class="mv-b" data-g="save"><i class="ic ico-ui_salvar"></i> Salvar jogo</button>',
      '<button class="mv-b" data-g="load">📜 Carregar jogo</button>',
      '<button class="mv-b" data-g="opts">⚙ Opções</button>',
      '<button class="mv-b danger" data-g="title">⌂ Voltar ao título</button>',
    ].join("") +
    "</div>";
  card.onclick = (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b) return;
    const g = b.dataset.g;
    if (g === "resume") mvClose(p);
    else if (g === "save") openSlots("save", () => {});
    else if (g === "load")
      openSlots("load", (r?: string) => {
        if (r === "loaded") {
          p._onClose = null;
          p.classList.remove("open");
          world.paused = false;
        }
      });
    else if (g === "opts") openOptions();
    else if (g === "title") {
      if (!b.dataset.sure) {
        b.dataset.sure = "1";
        b.textContent = "⌂ Sair sem salvar? (clique de novo)";
        return;
      }
      p._onClose = null;
      p.classList.remove("open");
      openTitle();
    }
  };
  p.classList.add("open");
}

/* ---------- inicialização ---------- */
export function metaInit() {
  MEMO.ECON0 = JSON.parse(JSON.stringify(econ));
  hudBuild();
  tsBuild();
  optApply();
  setInterval(() => {
    if (!TS.open) hudUpdate();
    try {
      quadTick(0.25);
    } catch (e) {
      console.warn(e);
    }
  }, 250);
  let _lt = performance.now();
  setInterval(() => {
    const n = performance.now();
    autosaveTick((n - _lt) / 1000);
    _lt = n;
  }, 5000);
  window.addEventListener(
    "keydown",
    (e) => {
      if (VOIDD.aberta) return; // v7.7: a vinheta Voidd (intro/voidd.ts) está por cima; a tecla só a pula
      if (INTRO.open) {
        if (e.code === "Escape") introSkip();
        else if (e.code === "Space" || e.code === "Enter") introNext();
        e.preventDefault();
        return;
      }
      if (TS.open) {
        const el = document.getElementById("title-screen")!;
        if (document.querySelector(".mv-panel.open")) {
          if (e.code === "Escape") mvClose(document.querySelector<HTMLElement>(".mv-panel.open")!);
          return;
        }
        if (!el.classList.contains("menu")) {
          tsWake();
          e.preventDefault();
          return;
        }
        const bs = [...document.querySelectorAll("#ts-menu .ts-btn")];
        const ok = bs.map((b, i) => ((b as HTMLButtonElement).disabled ? -1 : i)).filter((i) => i >= 0);
        if (e.code === "ArrowDown" || e.code === "KeyS") {
          TS.sel = ok[(ok.indexOf(TS.sel) + 1) % ok.length];
          tsSel();
          e.preventDefault();
        } else if (e.code === "ArrowUp" || e.code === "KeyW") {
          TS.sel = ok[(ok.indexOf(TS.sel) - 1 + ok.length) % ok.length];
          tsSel();
          e.preventDefault();
        } else if (e.code === "Enter" || e.code === "Space") {
          const b = bs[TS.sel] as HTMLButtonElement;
          if (b && !b.disabled) tsAct(b.dataset.act!);
          e.preventDefault();
        }
        return;
      }
      if (e.code === "Escape" && !dungeon.active) {
        if (cacadaDispensar()) return; // v7.7: o aviso da caçada (map/cacada.ts): segue automática
        if (SEL.grupo.length) {
          limparSelecao(); // v7.7: Esc primeiro limpa a seleção do mapa (map/selecao.ts)
          return;
        }
        const open = document.querySelector<HTMLElement>(".mv-panel.open");
        if (open) {
          mvClose(open);
          return;
        }
        if (!anyGameModal()) {
          openGameMenu();
        }
      }
    },
    true,
  );
  openTitle();
}
