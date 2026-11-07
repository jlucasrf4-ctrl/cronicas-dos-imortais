/* ==== Fase 4 ====
   configuração da simulação: CONFIG (tick, dia, raio de interação, região ativa), acampamento inicial (SPAWN0),
   célula da grade espacial e ângulos de desvio do movimento. Saíram de base/00 e base/01 */

/* ---------------------------------------------------------------------
   0. CONFIG
--------------------------------------------------------------------- */
export const CONFIG = {
  TICK_MIN: 1, // 1 tick = 1 minuto simulado
  TICKS_PER_SEC_BASE: 4, // a 1x: 4 min simulados por segundo real (escala de continente, mais contemplativo)
  DAY_MIN: 24 * 60,
  WATER_SAMPLE_STEP: 4, // passo (px) da varredura de água
  VEG_SPACING: 22, // espaçamento da grade de vegetação (px)
  INTERACT_RADIUS: 13, // distância "cheguei no alvo"
  SIM_BOUNDS: { x: 150, y: 150, w: 670, h: 500 }, // região ativa (coords do mapa)
  MAX_EVENTS: 6000,
  STATS_SAMPLE_EVERY_MIN: 60, // amostra populacional a cada hora simulada
  MAX_STATS_SAMPLES: 180,
};

export const SPAWN0 = { x: 140, y: 560 }; // acampamento inicial (coords do mapa original), na ilha do sudoeste
export const GRID_CELL = 70;
export const DEFLECT_ANGLES_DEG = [0, 18, -18, 36, -36, 54, -54, 72, -72, 90, -90, 115, -115];
