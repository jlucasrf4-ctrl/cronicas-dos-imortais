/* ==== Fase 4 — código de carga do antigo src/js/modulos/v5.9.14_mesa_analise.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarMesaAnalise() na ordem do antigo manifesto. */
import { econ } from "../../core/state.ts";
import { PROFS, PROF_BY } from "../../data/atributos.ts";
import { SKILL_LABELS } from "../../data/herois.ts";
import { GS_CODES } from "../../ui/gameshark.ts";

export function iniciarMesaAnalise() {
  /* ==== v5.9.14 — Mesa de análise: estudar itens para deduzir a receita da forja (proficiência Percepção) ==== */
  PROFS.push({
    id: "percepcao",
    n: "Percepção",
    i: "🔍",
    g: "Ofícios",
    d: "Analisar itens na mesa revela mais detalhes por vez; com o bastante, dá para deduzir a receita da forja.",
  });
  PROF_BY.percepcao = PROFS[PROFS.length - 1];
  SKILL_LABELS.percepcao = "Percepção";
  /* botão na carpintaria e na janela da base (só com a mesa montada) */
  GS_CODES.MESA = () => {
    econ.mesa = true;
    return "Mesa de trabalho montada no acampamento";
  };
}
