/* ==== v8.1 — estados da heroína perto dela (field/estados.ts; mantenedor, 2026-10-31: os três estilos, ligáveis nas
   Opções: dentro do anel, selos na borda, fita sob os pés com o painel completo) ==== */

/** troca: s que cada estado de combate fica dentro do anel; lembrete: s entre um lembrete e outro dos estados fora de
 *  combate (fome, frio, ferida, carga), que aparecem um a um por `troca` s; selos: quantos selos cabem na borda. */
export const ESTADOS_UI = { troca: 1.6, lembrete: 90, selos: 3 };

/** Limiares de cada estado (fração ou valor, como o jogo já usa em survival/sobrevivencia.ts): acima de `alerta` o
 *  selo é amarelo, acima de `perigo` vermelho. */
export const ESTADOS_LIM = {
  fome: { alerta: 60, perigo: 85 }, // h.hunger 0..100
  frio: { alerta: 50, perigo: 80 }, // h.cold 0..100
  ferida: { alerta: 0.1, perigo: 0.35 }, // ferimento / vida máxima
  carga: { alerta: 1, perigo: 1.3 }, // peso / capacidade
};
