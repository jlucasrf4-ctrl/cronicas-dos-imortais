/* ==== Fase 4 — código de carga do antigo src/js/modulos/v6.5_tutorial.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarTutorial() na ordem do antigo manifesto. */
import { CZ, ZOOM_JOG, ZOOM_PERTO, pertoComecar } from "../../field/tipos.ts";
import { toggleInv } from "../../field/chao.ts";
import { camera, dungeon, econ } from "../../core/state.ts";
import { PACK_KEYS } from "../../data/campo.ts";
import { ISC_FINTA } from "../../data/intro.ts";
import { ITEM_DEFS } from "../../data/itens.ts";
import { spawnDungeonToast } from "../../field/masmorra.ts";
import { ISC } from "../../intro/cena.ts";
import { cellsOf } from "../../items/inventario.ts";
import { tierShape } from "../../items/qualidade.ts";
import { applyCameraTransform, constrainCamera, zoomLimitOff } from "../../map/camera.ts";
import { GS_CODES } from "../../ui/gameshark.ts";
import { itemAnalyze } from "../../ui/inventario.ts";
import { JOGO, mapZoomLimit } from "../../ui/modos.ts";
import { sairDoCampo, dicaSaida } from "../../map/transicao.ts";

/** v7.7: o temporizador que esconde a dica da saída quando a roda para. */
const DICA = { t: 0 as ReturnType<typeof setTimeout> | 0 };

export function iniciarTutorial() {
  /* ==== v6.5 — tutorial (javali, flechas segurando, analisar pela mochila), acampamento, itens (durabilidade, ícone, pacotes 9/9), olhar para onde anda, modos Jogo/Mapa ==== */
  /* ---------- javali da abertura: só investe depois de 2 flechas; antes só rodeia e mira ---------- */
  setInterval(() => {
    try {
      const m = ISC.on && ISC.ph === "boar" ? ISC.boar : null;
      if (!m || !m.alive) return;
      if ((ISC.shots || 0) >= ISC_FINTA || econ.quiver.n <= 0) return;
      if (m.st === "bwind" && m.t < 0.18) {
        m.st = "chase";
        m.bcd = 0.9 + Math.random() * 0.9;
        spawnDungeonToast("😤", m.x, m.y - 34, "#ff9a6a", 14);
      }
    } catch (_) {}
  }, 50);
  /* ---------- Faca Velha: abre a mochila e você analisa pelo item (🔍) ---------- */
  window.addEventListener(
    "pointerdown",
    (e) => {
      const b = e.target && (e.target as HTMLElement).closest && (e.target as HTMLElement).closest(".inv-ana");
      if (!b || !b._it) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.button === 0 || e.pointerType !== "mouse") {
        const it = b._it;
        setTimeout(() => itemAnalyze(it), 0);
      }
    },
    true,
  );
  window.addEventListener(
    "click",
    (e) => {
      if (e.target && (e.target as HTMLElement).closest && (e.target as HTMLElement).closest(".inv-ana")) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    },
    true,
  );
  /* ---------- acampamento: tutorial sempre na 1ª entrada; Sim/Não aparece por cima da mochila; janela de cozinhar fecha antes da conversa ---------- */
  /* ---------- itens ---------- */
  /* pacotes 9/9: itens pequenos (pena, pedra…) empilham ocupando as casinhas livres do próprio quadrado 3×3 */
  for (const k of PACK_KEYS) {
    const d = ITEM_DEFS[k];
    if (!d) continue;
    try {
      const b = cellsOf(tierShape(k, 0));
      d.stack = 1 + Math.max(0, 9 - b);
      d.packBase = b;
    } catch (_) {}
  }
  /* ---------- MODOS: Jogo (sala em 3D) ⇄ Mapa, pela roda do mouse ---------- */
  /* v8.1 — roda do mouse: um clique (≈100) = um passo. O ruído de uma roda gasta (pulsos pequenos e de sinal trocado)
     soma e se anula, em vez de dar zoom para dentro e para fora a cada pulso */
  const RODA = { acc: 0, t: 0 };
  const rodaSentido = (e: WheelEvent): number => {
    const dy = e.deltaMode ? e.deltaY * 33 : e.deltaY;
    const agora = performance.now();
    if (agora - RODA.t > 250) RODA.acc = 0;
    RODA.t = agora;
    RODA.acc += dy;
    if (Math.abs(RODA.acc) < 100) return 0;
    const sentido = RODA.acc < 0 ? -1 : 1;
    RODA.acc = 0;
    return sentido;
  };
  setTimeout(function wheelBind() {
    const v = document.getElementById("dungeon-view");
    if (!v) {
      setTimeout(wheelBind, 500);
      return;
    }
    v.addEventListener("mv:zoom-perto", (ev) => {
      if (!dungeon.active || dungeon.crav || dungeon.finish) return;
      const delta = (ev as CustomEvent<number>).detail;
      if (typeof delta !== "number" || !Number.isFinite(delta)) return;
      if (delta > 0) pertoComecar(CZ.pertoAlvo + delta);
      else CZ.pertoAlvo = Math.max(0, CZ.pertoAlvo + delta);
      JOGO.wheel = 0;
    });
    v.addEventListener(
      "wheel",
      (e) => {
        const d = dungeon;
        if (!d.active) return;
        e.preventDefault();
        const sentido = rodaSentido(e);
        if (!sentido) return;
        /* v7.7 — roda do mouse: aproxima (até a distância antiga) e afasta (até o padrão); só no mais afastado o
           afastar continua juntando para sair ao mapa, como antes */
        if (sentido < 0) {
          e.preventDefault();
          // v8.0: no zoom máximo, a roda continua até o personagem, de frente (CZ.perto, renderer.ts vpPerto)
          if (CZ.jog >= ZOOM_JOG.max - 1e-6 && !d.crav && !d.finish) {
            pertoComecar(CZ.pertoAlvo + ZOOM_PERTO.passo);
            // no fim do zoom, a mochila abre ao lado da personagem (field/tipos.ts cravZoom: CZ.desloc)
            if (CZ.pertoAlvo >= 1 && !d.invOpen) {
              // a classe antes de abrir: o layout e as janelas da aljava já nascem no lugar do modo ao lado
              document.getElementById("inv-modal")?.classList.add("lateral");
              CZ.inv = true;
              toggleInv(true);
            }
          }
          CZ.jog = Math.min(ZOOM_JOG.max, CZ.jog + ZOOM_JOG.passo);
          JOGO.wheel = 0;
          CZ.saida = 0;
          dicaSaida(0);
          return;
        }
        if (sentido > 0 && CZ.pertoAlvo > 0) {
          if (CZ.inv && d.invOpen) toggleInv(false); // afastando, a mochila do lado fecha primeiro
          CZ.pertoAlvo = Math.max(0, CZ.pertoAlvo - ZOOM_PERTO.passo);
          JOGO.wheel = 0;
          return;
        }
        if (sentido > 0 && CZ.jog > 1) {
          CZ.jog = Math.max(1, CZ.jog - ZOOM_JOG.passo);
          JOGO.wheel = 0;
          return;
        }
        if (d.mode !== "campo" && !d.camp) return;
        if (sentido <= 0) {
          JOGO.wheel = 0;
          return;
        }
        const now = performance.now();
        if (now - JOGO.wt > 1200) JOGO.wheel = 0;
        JOGO.wt = now;
        JOGO.wheel += Math.min(120, e.deltaMode ? e.deltaY * 33 : e.deltaY);
        // v7.7: a câmera sobe aos poucos enquanto junta (prévia da saída) e a dica mostra quanto falta
        CZ.saida = Math.min(1, JOGO.wheel / 150);
        CZ.saidaT = now;
        dicaSaida(CZ.saida);
        clearTimeout(DICA.t);
        DICA.t = setTimeout(() => dicaSaida(0), 1200);
        if (JOGO.wheel >= 150) {
          JOGO.wheel = 0;
          sairDoCampo();
        }
      },
      { passive: false },
    );
  }, 300);
  /* saída da cena inicial: primeiro a sala de campo (Jogo); afastando o zoom abre o mapa */
  /* mapa: dá para passar da borda — o mar continua */
  setInterval(() => {
    try {
      if (dungeon.active || !econ.introDone || camera.zanim) return;
      const lo = mapZoomLimit();
      if (!zoomLimitOff && camera.scale < lo * 0.995) {
        const vp = document.getElementById("viewport"),
          cx = vp!.clientWidth / 2,
          cy = vp!.clientHeight / 2,
          wx = (cx - camera.tx) / camera.scale,
          wy = (cy - camera.ty) / camera.scale;
        camera.scale = lo;
        camera.zt = null;
        camera.tx = cx - wx * lo;
        camera.ty = cy - wy * lo;
        constrainCamera();
        applyCameraTransform();
      }
    } catch (_) {}
  }, 400);
  GS_CODES.MAPA = () => {
    econ.mapas = (econ.mapas! | 0) + 1;
    return "+1 mapa comprado (zoom do mapa vai mais longe): " + econ.mapas;
  };
  setInterval(() => {
    try {
      const el = document.getElementById("perc-hud");
      if (el && !dungeon.active) el.style.display = "none";
    } catch (_) {}
  }, 300);
}
