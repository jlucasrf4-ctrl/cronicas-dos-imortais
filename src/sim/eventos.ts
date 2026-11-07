/* ==== Fase 4 — registro de eventos do mundo (base/01) ==== */
import { world, SEL } from "../core/state.ts";
import { CONFIG } from "../core/config.ts";
import { CRIT } from "../field/campo_vida.ts";

/* ---------------------------------------------------------------------
   8. EVENTOS
--------------------------------------------------------------------- */
export function pushEvent(text: string) {
  /* v6.8 */
  if (CRIT.cur && typeof text === "string" && /lobo da masmorra|Lobo Alfa/.test(text)) return;
  world.events.push({ tick: world.tick, text });
  if (world.events.length > CONFIG.MAX_EVENTS) world.events.shift();
  SEL.renderEventFeedDirty = true;
}
