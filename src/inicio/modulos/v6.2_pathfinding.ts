/* ==== Fase 4 — código de carga do antigo src/js/modulos/v6.2_pathfinding.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarPathfinding() na ordem do antigo manifesto. */
import { world } from "../../core/state.ts";

export function iniciarPathfinding() {
  /* ==== v6.2 — PATHFINDING: grade de navegação, massas de terra, A* com rota suavizada e cache (portado da v3.0) ==== */
  world.navBudget = 40;
}
