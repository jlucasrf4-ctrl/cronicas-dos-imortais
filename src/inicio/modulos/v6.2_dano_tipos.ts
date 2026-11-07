/* ==== Fase 4 — código de carga do antigo src/js/modulos/v6.2_dano_tipos.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarDanoTipos() na ordem do antigo manifesto. */
import { dungeon } from "../../core/state.ts";
import { WPN } from "../../data/combate.ts";
import { ITEM_DEFS } from "../../data/itens.ts";
import { ensureFol } from "../../field/dano.ts";
import { cravRelease, folDrain } from "../../field/tipos.ts";
import { GS_CODES } from "../../ui/gameshark.ts";

export function iniciarDanoTipos() {
  /* ==== v6.2 — DANO EM 3 TIPOS (perfurante / cortante / impacto), ARMADURA POR TIPO, FÔLEGO DOS ANIMAIS E ARMA CRAVADA ==== */
  /* ---------- TABELAS (edite aqui) ---------- */
  ITEM_DEFS.eq_lanca.dmg = 0.9; // lança: dano bruto um pouco menor que a espada (compensa com a ponta que fura)
  WPN.clava.stun = 0;
  WPN.machado.bleed = 0;
  WPN.faca.bleed = 0; // agora vêm do impacto / corte
  /* ---------- arma cravada no corpo a corpo: empurrar (segurar) / arrancar (tocar) ---------- */
  window.addEventListener("pointerup", () => {
    try {
      cravRelease();
    } catch (_) {}
  });
  window.addEventListener("pointercancel", () => {
    try {
      cravRelease();
    } catch (_) {}
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "KeyX")
      try {
        cravRelease();
      } catch (_) {}
  });
  /* ---------- caça automática: abate limpo simplificado (precisa de faca) ---------- */
  GS_CODES.FOLEGO = () => {
    for (const m of dungeon.monsters || [])
      if (m.alive) {
        ensureFol(m);
        folDrain(m, m.fol!);
      }
    return "Todos os bichos da masmorra sem fôlego";
  };
}
