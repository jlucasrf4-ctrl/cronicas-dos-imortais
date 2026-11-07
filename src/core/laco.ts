/* ==== Fase 4 — laço principal: tick de simulação desacoplado do quadro (base/04) ==== */
import { TELAS, world, dungeon } from "./state.ts";
import { CONFIG } from "./config.ts";
import { prep } from "../econ/economia.ts";
import { sheet } from "../ui/ficha.ts";
import { updateHeroPanelUI, updateClockUI, updateEventFeedUI, updateStatsUI } from "../ui/painel.ts";
import { simTick } from "../sim/motor.ts";
import { renderDungeonFrame } from "../field/chao.ts";
import { renderFrame } from "../map/render.ts";
import { refreshInspectorIfOpen, checkExtinction } from "../ui/janelas.ts";
import { antesDoPasso, depoisDosPassos, usarVisual, voltarReal } from "../render/interpolar.ts";
import { antesDoDesenhoMapa, chegadaAcampamento, desenharCamadaMapa, quadroMapaNoCampo } from "../map/quadro.ts";

/** v7.7 — milissegundos por quadro para os passos da simulação (ver loop); no avanço rápido (+1h, +1d), mais. */
const LACO_ORC = 10,
  LACO_ORC_FF = 25;
export function loop(now: number) {
  requestAnimationFrame(loop);
  if (TELAS.lastFrameTime == null) TELAS.lastFrameTime = now;
  let deltaSec = (now - TELAS.lastFrameTime) / 1000;
  TELAS.lastFrameTime = now;
  if (deltaSec > 0.25) deltaSec = 0.25; // evita saltos grandes (aba em background etc.)

  // fast-forward: consome ticks "instantaneamente", em lotes, sem travar a UI
  /* v7.7 — os passos de cada quadro têm um teto de tempo (LACO_ORC), não só de quantidade: o "+1d" rodava 400 passos
     por quadro (~600 ms parado); agora avança o que cabe e continua no quadro seguinte. Em velocidade alta, se os
     passos não cabem no quadro, a simulação fica mais lenta em vez de acumular atraso e travar. */
  const t0 = performance.now();
  let passos = 0; // v7.7: quantos passos rodaram neste quadro (render/interpolar.ts)
  if (world.fastForwardTarget > 0) {
    let batch = 0;
    while (world.fastForwardTarget > 0 && batch < 400 && (batch === 0 || performance.now() - t0 < LACO_ORC_FF)) {
      if (!dungeon.active) antesDoPasso();
      simTick(CONFIG.TICK_MIN);
      passos++;
      world.fastForwardTarget -= CONFIG.TICK_MIN;
      batch++;
    }
  } else if (!world.paused) {
    TELAS.accumulatorSec += deltaSec * world.speedMult;
    const simSecPerTick = CONFIG.TICK_MIN / CONFIG.TICKS_PER_SEC_BASE;
    let guard = 0;
    while (TELAS.accumulatorSec >= simSecPerTick && guard < 60) {
      if (guard > 0 && performance.now() - t0 > LACO_ORC) {
        TELAS.accumulatorSec = Math.min(TELAS.accumulatorSec, simSecPerTick);
        break;
      }
      if (!dungeon.active) antesDoPasso();
      simTick(CONFIG.TICK_MIN);
      passos++;
      TELAS.accumulatorSec -= simSecPerTick;
      guard++;
    }
  }

  if (dungeon.active) {
    // a masmorra é outro "jogo": sua própria câmera e renderização, o
    // hub continua rodando por trás (outros heróis podem seguir em tarefa).
    quadroMapaNoCampo(now);
    renderDungeonFrame(Math.min(deltaSec, 0.1));
    return;
  }

  if (passos) depoisDosPassos();
  chegadaAcampamento();
  // v7.7: desenha cada um entre o passo anterior e o atual (movimento fluido); a simulação continua com a posição real
  const simSecPerTick = CONFIG.TICK_MIN / CONFIG.TICKS_PER_SEC_BASE;
  usarVisual(world.fastForwardTarget > 0 || world.paused ? 1 : TELAS.accumulatorSec / simSecPerTick);
  try {
    // v7.7: a câmera do quadro (teclas, zoom, centralizar, seguir) antes do desenho, tudo na mesma câmera
    antesDoDesenhoMapa(now, deltaSec);
    if (!(prep.open || sheet.open) || (TELAS._mapSkip = (TELAS._mapSkip + 1) % 3) === 0) {
      renderFrame(); // v5.7: com tela cheia aberta, o mapa atualiza menos
      desenharCamadaMapa(now);
    }
  } finally {
    voltarReal();
  }
  updateClockUI();
  updateEventFeedUI();

  // painéis de texto (população, heróis, checagem de extinção) não precisam
  // de 60 atualizações por segundo — reconstruir o DOM nessa taxa era a
  // causa do lag. Throttle pra ~4x/seg, suficiente pra parecer "ao vivo".
  if (now - TELAS.lastPanelUpdate > 260) {
    TELAS.lastPanelUpdate = now;
    refreshInspectorIfOpen(); // v7.7: o inspetor também (era refeito a cada quadro)
    updateStatsUI();
    updateHeroPanelUI();
    checkExtinction();
  }
}
