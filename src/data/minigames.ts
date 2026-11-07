/* ==== Fase 4 — definições dos minigames de trabalho (MG_DEFS). Saiu de base/06 (v3.10) ==== */

export interface MinijogoDef {
  title: string;
  rounds: number;
  zone: number;
  speed: number;
  attr: string;
  tip: string;
}
export const MG_DEFS: Record<string, MinijogoDef> = {
  rock: {
    title: "⛏ Mineração",
    rounds: 6,
    zone: 0.22,
    speed: 0.95,
    attr: "destreza",
    tip: "Pare a marca dentro da faixa verde. O miolo dourado é golpe perfeito.",
  },
  tree: {
    title: "🪓 Coleta de lenha e galhos",
    rounds: 5,
    zone: 0.26,
    speed: 0.85,
    attr: "forca",
    tip: "Pare a marca dentro da faixa verde. O miolo dourado é golpe perfeito.",
  },
  fish: {
    title: "🎣 Pesca",
    rounds: 5,
    zone: 0.17,
    speed: 1.15,
    attr: "destreza",
    tip: "Fisgue quando a marca passar pela faixa verde. A faixa é estreita!",
  },
};
