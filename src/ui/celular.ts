/* ==== Fase 4 — celular: toque no mapa, abas, joystick e botões (v4.4, v5.9.08) ==== */
import { centerCamp, centerHero } from "../hero/proficiencias.ts";
import { dungeon, OPT, camera, TELAS } from "../core/state.ts";
import { fitDungeonCanvas, switchWeapon, nearestLoot, inExitZone } from "../field/masmorra.ts";
import { eApertado, eSolto } from "./acoes.ts";
import { MOB_TABS } from "../data/mapa.ts";
import { clamp } from "../core/util.ts";
import { constrainCamera, applyCameraTransform, applyZoom } from "../map/camera.ts";
import { D3 } from "../field/projecao.ts";
import { spearMode, spearDodge, spearChargeStart, bowRoll, espacoCorpo } from "../field/armas.ts";
import { toggleInv, doParry, rotateDrag } from "../field/chao.ts";
import { startCharge, dungeonAttack, fireArrow } from "../field/acertos.ts";
import { healHerb } from "../econ/armaria.ts";
import { openSheet } from "./ficha.ts";
import { mobIcons } from "./icones.ts";
import { runeNearDungeon } from "../runas/runas.ts";
import { INV } from "../items/inventario.ts";
import type { Ponto } from "../core/tipos.ts";

/* =====================================================================
   v4.4 — CELULAR: toque no mapa (pinça para zoom), abas inferiores,
   controles de toque na masmorra (joystick + botões) e mira automática.
   Opções → "Controles de toque": automático / sempre / nunca.
===================================================================== */
interface EstadoMOB {
  on: boolean;
  aim: number | null; // ângulo de mira do botão de ataque (arrastado)
  face: number | null; // para onde o joystick apontou por último
  tapT: number;
  mouseReal: boolean;
  tab: string | null;
  pins: Map<number, Ponto>; // dedos na tela (pinça)
  pinch: { x: number; y: number; d: number } | null; // centro e distância dos dois dedos
  eatUp: boolean;
  // acrescentados depois
  _ic?: number;
}
export const MOB: EstadoMOB = {
  on: false,
  aim: null,
  face: null,
  tapT: 0,
  mouseReal: false,
  tab: null,
  pins: new Map(),
  pinch: null,
  eatUp: false,
};

/* ==== v5.9.08 — correções de celular ==== */
/* botões de ataque/troca: o ícone antigo (emoji) e o novo (imagem) brigavam e ficavam trocando sozinhos */
/* atalhos de centralizar (personagem / acampamento): garante que os botões existam sempre */
export function zoomBtnsEnsure() {
  const z = document.getElementById("zoom-controls");
  if (!z) return;
  if (!document.getElementById("zoom-camp")) {
    const b = document.createElement("button");
    b.className = "zoom-btn";
    b.id = "zoom-camp";
    b.title = "Centralizar no acampamento (C)";
    b.textContent = "⛺";
    b.onclick = () => centerCamp();
    z.prepend(b);
  }
  if (!document.getElementById("zoom-hero")) {
    const a = document.createElement("button");
    a.className = "zoom-btn";
    a.id = "zoom-hero";
    a.title = "Centralizar no personagem (V) — de novo alterna entre eles";
    a.textContent = "👤";
    a.onclick = () => centerHero();
    z.prepend(a);
  }
  let w = document.getElementById("zoom-world") as HTMLButtonElement | null;
  if (!w) {
    w = document.createElement("button");
    w.className = "zoom-btn";
    w.id = "zoom-world";
    w.type = "button";
    w.addEventListener("click", () => document.dispatchEvent(new CustomEvent("mv:mobile-world-transition")));
    z.appendChild(w);
  }
  const noCampo = !dungeon.active;
  w.textContent = noCampo ? "🌲 Mundo" : "🗺 Mapa";
  w.title = noCampo ? "Entrar no mundo com a personagem atual" : "Voltar ao mapa";
  w.setAttribute("aria-label", w.title);
  w.classList.toggle("fora", noCampo);
  document.documentElement.classList.toggle("mob-campo", MOB.on && !noCampo);
}

export function mobAim() {
  // mira automática: alvo marcado → inimigo mais próximo → direção do joystick
  if (MOB.aim != null) return MOB.aim;
  const d = dungeon,
    t = d.target;
  if (t && t.alive) return Math.atan2(t.y - d.py, t.x - d.px);
  let b = null,
    bd = d.tile * 9;
  for (const m of d.monsters) {
    if (!m.alive) continue;
    const dd = Math.hypot(m.x - d.px, m.y - d.py);
    if (dd < bd) {
      bd = dd;
      b = m;
    }
  }
  if (b) return Math.atan2(b.y - d.py, b.x - d.px);
  return MOB.face;
}

function mobDetect() {
  const t = OPT.touch || "auto";
  if (t === "on") return true;
  if (t === "off") return false;
  return (
    matchMedia("(pointer: coarse)").matches || ("ontouchstart" in window && Math.min(innerWidth, innerHeight) < 820)
  );
}
export function mobApply() {
  const was = MOB.on;
  MOB.on = mobDetect();
  const R = document.documentElement;
  R.classList.toggle("mob", MOB.on);
  R.classList.toggle("mob-port", MOB.on && innerHeight > innerWidth);
  zoomBtnsEnsure();
  const tp = document.getElementById("ts-press");
  if (tp) tp.textContent = MOB.on ? "Toque para começar" : "Clique ou pressione qualquer tecla";
  const eh = document.getElementById("empty-hint");
  if (eh)
    eh.textContent = MOB.on
      ? "Arraste para mover · pinça para zoom · toque num bicho, planta ou runa para ver detalhes"
      : "Arraste para mover · role para zoom · toque num animal ou planta pra inspecionar";
  const dh = document.getElementById("dungeon-hint");
  if (dh && MOB.on)
    dh.textContent =
      "Joystick à esquerda para andar (empurre até a borda para correr) · ⚔ ataca o inimigo mais próximo · segure 🛡 para bloquear";
  if (!MOB.on) mobTab(null);
  if (was !== MOB.on && typeof dungeon !== "undefined" && dungeon.active) fitDungeonCanvas();
}

/* ---- mapa: abas inferiores (painéis viram folhas que sobem de baixo) ---- */
function mobTab(t: string | null | undefined) {
  const R = document.documentElement;
  for (const [k] of MOB_TABS) R.classList.remove("mt-" + k);
  MOB.tab = t && MOB.tab !== t ? t : null;
  if (MOB.tab) {
    R.classList.add("mt-" + MOB.tab);
    document.getElementById("inspector")!.classList.remove("open");
  }
  document
    .querySelectorAll("#mob-nav button")
    .forEach((b) => b.classList.toggle("on", (b as HTMLElement).dataset.t === MOB.tab));
}
function mobBuildNav() {
  if (document.getElementById("mob-nav")) return;
  const n = document.createElement("div");
  n.id = "mob-nav";
  n.innerHTML = MOB_TABS.map(
    ([k, i, l]) => '<button data-t="' + k + '"><span>' + i + "</span><small>" + l + "</small></button>",
  ).join("");
  document.getElementById("app")!.appendChild(n);
  n.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button[data-t]") as HTMLElement;
    if (b) mobTab(b.dataset.t);
  });
}

/* ---- mapa: pinça para zoom (dois dedos) sem atrapalhar o arrastar ---- */
function mobPinchInit() {
  const vp = document.getElementById("viewport");
  if (!vp) return;
  const mid = () => {
    const p = [...MOB.pins.values()];
    return { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2, d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) };
  };
  vp.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType !== "touch") return;
      MOB.pins.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (MOB.tab) mobTab(null);
      if (MOB.pins.size === 2) {
        e.stopImmediatePropagation();
        vp.dispatchEvent(new PointerEvent("pointercancel", { pointerId: [...MOB.pins.keys()][0] }));
        MOB.pinch = mid();
        MOB.eatUp = true;
        camera.zt = null;
      } else if (MOB.pins.size > 2) e.stopImmediatePropagation();
    },
    true,
  );
  vp.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "touch" || !MOB.pins.has(e.pointerId)) return;
      MOB.pins.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (MOB.pins.size >= 2 && MOB.pinch) {
        e.stopImmediatePropagation();
        const m = mid(),
          f = m.d / Math.max(10, MOB.pinch.d);
        camera.tx += m.x - MOB.pinch.x;
        camera.ty += m.y - MOB.pinch.y;
        const r = vp.getBoundingClientRect();
        applyZoom(clamp(camera.scale * f, camera.minScale, camera.maxScale), m.x - r.left, m.y - r.top);
        camera.zt = null;
        constrainCamera();
        applyCameraTransform();
        MOB.pinch = m;
      }
    },
    true,
  );
  const up = (e: PointerEvent) => {
    if (e.pointerType !== "touch") return;
    MOB.pins.delete(e.pointerId);
    if (MOB.pins.size < 2) MOB.pinch = null;
    if (MOB.eatUp) {
      e.stopImmediatePropagation();
      if (!MOB.pins.size) MOB.eatUp = false;
    }
  };
  vp.addEventListener("pointerup", up, true);
  vp.addEventListener(
    "pointercancel",
    (e) => {
      if (e.isTrusted) up(e);
    },
    true,
  );
}

/* ---- masmorra: joystick + botões ---- */
function mobBuildTouch() {
  if (document.getElementById("touch-ui")) return;
  const t = document.createElement("div");
  t.id = "touch-ui";
  t.innerHTML =
    '<div id="tj-zone"><div id="tj-base"><div id="tj-knob"></div></div><div id="tj-tip">mova</div></div>' +
    '<div id="tb-cluster"><button id="tb-atk" class="tb big">⚔</button><button id="tb-def" class="tb">🛡</button><button id="tb-parry" class="tb">⚡<small>parry</small></button><button id="tb-swap" class="tb">🏹<small>trocar</small></button><button id="tb-e" class="tb">✋<small>E</small></button><button id="tb-herb" class="tb">🌿<small>erva</small></button></div>' +
    '<div id="tb-top"><button id="tb-inv" class="tb sm">🎒</button><button id="tb-sheet" class="tb sm">📜</button></div><div id="mob-rotate">📱↻ Deite o celular para ver mais da arena</div>';
  document.getElementById("dungeon-view")!.appendChild(t);
  const zoom = document.createElement("div");
  zoom.id = "tb-zoom";
  zoom.innerHTML =
    '<button class="tb sm" data-zoom="-1" aria-label="Afastar câmera" title="Afastar câmera">−</button><button class="tb sm" data-zoom="1" aria-label="Aproximar câmera" title="Aproximar câmera">+</button>';
  t.querySelector("#tb-cluster")!.prepend(zoom);
  const telaCheia = document.createElement("button");
  telaCheia.id = "tb-fullscreen";
  telaCheia.className = "tb sm";
  telaCheia.textContent = "⛶";
  telaCheia.title = "Entrar em tela cheia";
  telaCheia.setAttribute("aria-label", telaCheia.title);
  t.querySelector("#tb-top")!.appendChild(telaCheia);
  const atualizarTelaCheia = () => {
    const ativa = !!document.fullscreenElement;
    telaCheia.title = ativa ? "Sair da tela cheia" : "Entrar em tela cheia";
    telaCheia.setAttribute("aria-label", telaCheia.title);
    document.documentElement.classList.toggle("tela-cheia", ativa);
  };
  telaCheia.addEventListener("click", () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else if (document.documentElement.requestFullscreen) {
      void document.documentElement.requestFullscreen().catch(() => {
        telaCheia.title = "O Chrome recusou a tela cheia. Tente tocar novamente.";
      });
    } else {
      telaCheia.title = "Este navegador não permite tela cheia nesta página.";
    }
  });
  document.addEventListener("fullscreenchange", atualizarTelaCheia);
  t.querySelectorAll<HTMLButtonElement>("#tb-zoom [data-zoom]").forEach((b) =>
    b.addEventListener("click", () => {
      document
        .getElementById("dungeon-view")
        ?.dispatchEvent(new CustomEvent("mv:zoom-perto", { detail: Number(b.dataset.zoom) * 0.2 }));
    }),
  );
  const zone = t.querySelector("#tj-zone") as HTMLElement,
    base = t.querySelector("#tj-base") as HTMLElement,
    knob = t.querySelector("#tj-knob") as HTMLElement,
    RR = 54;
  let jid: number | null = null,
    c0: Ponto | null = null;
  const setJ = (x: number, y: number) => {
    const dx = x - c0!.x,
      dy = y - c0!.y,
      L = Math.hypot(dx, dy),
      k = Math.min(1, L / RR),
      ux = L ? dx / L : 0,
      uy = L ? dy / L : 0;
    knob.style.transform = "translate(" + ux * k * RR + "px," + uy * k * RR + "px)";
    const lv = k < 0.15 ? 0 : k < 0.45 ? 1 : k < 0.8 ? 2 : 3,
      dz = lv === 0 ? 0 : lv === 1 ? 0.6 + (0.4 * (k - 0.15)) / 0.3 : 1;
    dungeon.joy = { x: ux * dz, y: uy * dz, run: lv === 3, jog: lv === 2, lv };
    if (dz > 0.2) MOB.face = Math.atan2(uy, ux);
    base.classList.toggle("run", lv === 3);
    if (base.dataset.lv !== String(lv)) {
      base.dataset.lv = String(lv);
      base.dataset.lbl = ["", "andar", "trotar", "correr"][lv];
    }
  };
  zone.addEventListener("pointerdown", (e) => {
    if (!dungeon.active || jid != null) return;
    e.preventDefault();
    jid = e.pointerId;
    try {
      zone.setPointerCapture(jid);
    } catch (_) {}
    const zr = zone.getBoundingClientRect();
    c0 = { x: e.clientX, y: e.clientY };
    base.style.left = e.clientX - zr.left + "px";
    base.style.top = e.clientY - zr.top + "px";
    base.classList.add("on");
    (t.querySelector("#tj-tip") as HTMLElement).style.display = "none";
    setJ(e.clientX, e.clientY);
  });
  zone.addEventListener("pointermove", (e) => {
    if (e.pointerId !== jid) return;
    e.preventDefault();
    setJ(e.clientX, e.clientY);
  });
  const jEnd = (e: PointerEvent) => {
    if (e.pointerId !== jid) return;
    jid = null;
    dungeon.joy = null;
    base.classList.remove("on", "run");
    base.dataset.lv = "0";
    base.dataset.lbl = "";
    knob.style.transform = "";
  };
  zone.addEventListener("pointerup", jEnd);
  zone.addEventListener("pointercancel", jEnd);
  const atk = t.querySelector("#tb-atk") as HTMLElement;
  let aid: number | null = null,
    a0: Ponto | null = null;
  atk.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (!dungeon.active) return;
    aid = e.pointerId;
    a0 = { x: e.clientX, y: e.clientY };
    MOB.aim = null;
    try {
      atk.setPointerCapture(aid);
    } catch (_) {}
    dungeon.mouse = null;
    dungeon.mouseC = null;
    dungeon.weapon === "bow" ? startCharge() : dungeonAttack();
  });
  atk.addEventListener("pointermove", (e) => {
    if (e.pointerId !== aid) return;
    const dx = e.clientX - a0!.x,
      dy = e.clientY - a0!.y;
    if (Math.hypot(dx, dy) > 22) MOB.aim = Math.atan2(dy / Math.max(0.5, D3.on ? D3.SIN! : 1), dx);
  });
  const aEnd = (e: PointerEvent) => {
    if (e.pointerId !== aid) return;
    aid = null;
    if (dungeon.weapon === "bow") fireArrow();
    setTimeout(() => {
      MOB.aim = null;
    }, 120);
  };
  atk.addEventListener("pointerup", aEnd);
  atk.addEventListener("pointercancel", aEnd);
  const def = t.querySelector("#tb-def")!;
  def.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (spearMode()) spearDodge();
    else espacoCorpo(); // v7.7: sem escudo = ginga
  });
  for (const ev of ["pointerup", "pointercancel", "pointerleave"])
    def.addEventListener(ev, () => {
      dungeon.guard = false;
    });
  t.querySelector("#tb-parry")!.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    spearMode() ? spearChargeStart() : dungeon.weapon === "bow" ? bowRoll() : doParry();
  });
  t.querySelector("#tb-swap")!.addEventListener("click", () => {
    switchWeapon();
    mobSyncIcons();
  });
  {
    // v7.7: toque rápido no ✋ pega; segurar num item abre a mochila com ele (ui/acoes.ts)
    const b = t.querySelector<HTMLElement>("#tb-e")!;
    b.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      eApertado();
    });
    for (const fim of ["pointerup", "pointercancel", "pointerleave"]) b.addEventListener(fim, () => eSolto());
  }
  t.querySelector("#tb-herb")!.addEventListener("click", () => healHerb());
  t.querySelector("#tb-inv")!.addEventListener("click", () => toggleInv());
  t.querySelector("#tb-sheet")!.addEventListener("click", () => {
    if (dungeon.active && dungeon.hero) openSheet(dungeon.hero.id);
  });
  t.addEventListener("contextmenu", (e) => e.preventDefault());
  const dc = document.getElementById("dungeon-canvas")!;
  const dedosZoom = new Map<number, Ponto>();
  let distanciaZoom = 0;
  dc.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType !== "touch") return;
      dedosZoom.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (dedosZoom.size === 2) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const [a, b] = [...dedosZoom.values()];
        distanciaZoom = Math.hypot(a.x - b.x, a.y - b.y);
        dc.dispatchEvent(new PointerEvent("pointercancel", { pointerId: [...dedosZoom.keys()][0] }));
      }
    },
    true,
  );
  dc.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "touch" || !dedosZoom.has(e.pointerId) || dedosZoom.size < 2) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      dedosZoom.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...dedosZoom.values()],
        distancia = Math.hypot(a.x - b.x, a.y - b.y);
      if (distanciaZoom > 0 && Math.abs(distancia - distanciaZoom) > 8) {
        const delta = clamp((distancia - distanciaZoom) / 120, -0.2, 0.2);
        document.getElementById("dungeon-view")?.dispatchEvent(new CustomEvent("mv:zoom-perto", { detail: delta }));
        distanciaZoom = distancia;
      }
    },
    true,
  );
  const fimZoom = (e: PointerEvent) => {
    if (e.pointerType !== "touch" || !e.isTrusted) return;
    dedosZoom.delete(e.pointerId);
    if (dedosZoom.size < 2) distanciaZoom = 0;
  };
  dc.addEventListener("pointerup", fimZoom, true);
  dc.addEventListener("pointercancel", fimZoom, true);
  dc.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType === "touch") MOB.tapT = performance.now();
    },
    true,
  );
  dc.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "mouse") MOB.mouseReal = true;
    },
    true,
  );
}
function mobSyncIcons() {
  // reescrita na v5.9.08
  try {
    mobIcons();
  } catch (_) {}
}
export function mobDungeonTick() {
  document.documentElement.classList.toggle("mob-campo", MOB.on && dungeon.active);
  const entrarMapa = document.getElementById("zoom-world");
  if (entrarMapa) {
    entrarMapa.textContent = dungeon.active ? "🗺 Mapa" : "🌲 Mundo";
    entrarMapa.title = dungeon.active ? "Voltar ao mapa" : "Entrar no mundo com a personagem atual";
    entrarMapa.setAttribute("aria-label", entrarMapa.title);
  }
  if (!MOB.on || !dungeon.active) return;
  if (!MOB.mouseReal && dungeon.mouseC && performance.now() - MOB.tapT > 450) {
    dungeon.mouse = null;
    dungeon.mouseC = null;
  }
  const e = document.getElementById("tb-e");
  if (e) {
    const can = !dungeon.dead && (nearestLoot() || runeNearDungeon() || inExitZone());
    e.classList.toggle("hot", !!can);
  }
  if ((MOB._ic = (MOB._ic || 0) + 1) % 20 === 0) mobSyncIcons();
}
export function mobInit() {
  mobBuildNav();
  mobBuildTouch();
  mobPinchInit();
  mobApply();
  window.addEventListener("resize", () => {
    clearTimeout(TELAS._mobRz);
    TELAS._mobRz = setTimeout(mobApply, 120);
  });
  window.addEventListener("orientationchange", () =>
    setTimeout(() => {
      mobApply();
      if (dungeon.active) fitDungeonCanvas();
    }, 300),
  );
  window.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType === "touch" && OPT.touch !== "off" && !MOB.on) mobApply();
    },
    true,
  );
  // girar item enquanto arrasta (segundo dedo)
  const rb = document.createElement("button");
  rb.id = "mob-rot";
  rb.className = "btn";
  rb.textContent = "↻ Girar";
  document.body.appendChild(rb);
  rb.addEventListener(
    "pointerdown",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (INV.invDrag) rotateDrag();
    },
    true,
  );
  setInterval(() => {
    rb.classList.toggle("on", !!(MOB.on && INV.invDrag));
  }, 120);
  setInterval(() => {
    const tp = document.getElementById("ts-press");
    if (tp && MOB.on && tp.textContent !== "Toque para começar") tp.textContent = "Toque para começar";
  }, 500);
  rb.addEventListener("pointerup", (e) => e.stopPropagation(), true);
}
