/* ==== Fase 4 — código de carga do antigo src/js/modulos/v6.4_moitas_criacao.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarMoitasCriacao() na ordem do antigo manifesto. */
import { SEL, dungeon, econ, world } from "../../core/state.ts";
import { MAP_KEYS } from "../../data/mapa.ts";
import { spawnDungeonToast } from "../../field/masmorra.ts";
import { inMoita } from "../../field/moitas.ts";
import { mapOverview } from "../../map/camera.ts";
import { MAPCTL, balHit, mapGoCamp, mapHero, mapHitsSomething, mapW } from "../../map/controle.ts";
import { snapToLand } from "../../sim/animais.ts";
import { nearCamp } from "../../survival/acampamento.ts";
import { GS_CODES } from "../../ui/gameshark.ts";
import { avisoBaseAbrir } from "../../ui/menu_base.ts";
import { updateHeroPanelUI } from "../../ui/painel.ts";
import { TS, anyGameModal } from "../../ui/titulo.ts";

export function iniciarMoitasCriacao() {
  /* ==== v6.4 — moitas (zona segura), cena própria na criação, saída da cena inicial para o mapa, mapa com clique/WASD, balão que executa, tutorial do acampamento ==== */
  /* ---------- MOITAS: esconderijos (os lobos não te veem); só a moita da entrada leva de volta ao mapa ---------- */
  setInterval(() => {
    try {
      const d = dungeon;
      if (!d.active || d.mode !== "expedition") return;
      const b = inMoita();
      if (b && d._moita !== b) spawnDungeonToast("🌿 Escondido na moita", d.px, d.py - 44, "#9fe38a", 12);
      d._moita = b;
    } catch (_) {}
  }, 300);

  /* ---------- MAPA: clique para andar, WASD, balão que já executa ---------- */
  document.addEventListener(
    "pointerdown",
    (e) => {
      const vp = document.getElementById("viewport");
      if (!vp || !vp.contains(e.target as Node)) return;
      MAPCTL.down = { x: e.clientX, y: e.clientY };
    },
    true,
  );
  document.addEventListener(
    "pointerup",
    (e) => {
      try {
        const vp = document.getElementById("viewport");
        if (!vp || !vp.contains(e.target as Node) || !MAPCTL.down || dungeon.active) return;
        const D = MAPCTL.down;
        MAPCTL.down = null;
        if (Math.hypot(e.clientX - D.x, e.clientY - D.y) > 6 || SEL.commandMode || anyGameModal()) return;
        const w = mapW(e);
        if (balHit(w.x, w.y)) {
          MAPCTL.clickT = performance.now();
          const B = MAPCTL.bal;
          if (B!.kind === "camp") mapGoCamp(world.heroes.find((x) => x.id === B!.hero)!);
          else if (B!.kind === "aviso") avisoBaseAbrir();
          return;
        }
        if (e.pointerType === "mouse") return; // v7.7: no mouse, andar é o botão direito (map/selecao.ts)
        if (mapOverview()) return;
        if (econ.campTut === 1 && nearCamp(w.x, w.y)) {
          MAPCTL.clickT = performance.now();
          mapGoCamp(mapHero()!);
          return;
        }
        if (mapHitsSomething(w.x, w.y)) return;
        const h = mapHero();
        if (!h) return;
        const p = snapToLand(w.x, w.y);
        if (!p) return;
        MAPCTL.clickT = performance.now();
        h.walkTo = { x: p.x, y: p.y };
        h.task = null;
        h.targetEntity = null;
        h.state = "walking";
        h._enterCamp = false;
        MAPCTL.sel = h.id;
        updateHeroPanelUI();
      } catch (err) {
        console.warn(err);
      }
    },
    true,
  );
  window.addEventListener("keydown", (e) => {
    if (
      dungeon.active ||
      !MAP_KEYS[e.code] ||
      (e.target && /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)) ||
      anyGameModal() ||
      (typeof TS !== "undefined" && TS.open)
    )
      return;
    const app = document.getElementById("app");
    if (!app || app.style.display === "none") return;
    MAPCTL.keys[e.code] = true;
    e.preventDefault();
  });
  window.addEventListener("keyup", (e) => {
    delete MAPCTL.keys[e.code];
  });
  window.addEventListener("blur", () => {
    MAPCTL.keys = {};
  });
  // v7.7: o antigo mapLoop (WASD/borda da tela movendo a câmera, chegar no acampamento) agora roda no laço principal,
  // antes do desenho (map/quadro.ts: antesDoDesenhoMapa, chegadaAcampamento, quadroMapaNoCampo)

  /* ---------- ACAMPAMENTO: chegada com o Caçador (fogueira → carne SS → jantar → barraca → cochilo) ---------- */
  GS_CODES.ACAMP = () => {
    const h = world.heroes[0];
    if (!h) return "Sem personagem";
    econ.campTut = 1;
    econ.hunterNap = false;
    if (h.state === "idle" && h.camp) {
      const p = snapToLand(h.camp.x + 6, h.camp.y + 78);
      if (p) {
        h.x = p.x;
        h.y = p.y;
        h.state = "field";
      }
    }
    return "Tutorial do acampamento: ande até o acampamento e toque no balão";
  };
}
