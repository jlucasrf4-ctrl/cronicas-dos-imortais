/* ==== Fase 4 — código de carga do antigo src/js/modulos/v5.0_atributos.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarAtributos() na ordem do antigo manifesto. */
import { ATTR_DEFS } from "../../data/nascimento.ts";
import { prepHero } from "../../expedicao/preparo.ts";
import { treinoDeQualquerLugar } from "../../field/treino.ts";

export function iniciarAtributos() {
  // a fórmula nova do corpo a corpo (substitui a antiga, que crescia demais com a maestria)

  /* ---------- SALA DE TREINO ---------- */
  setTimeout(() => {
    const b = document.getElementById("prep-train");
    if (b)
      b.addEventListener("click", () => {
        const h = prepHero();
        if (h) treinoDeQualquerLugar(h.id);
      });
  }, 0);

  // descrições dos atributos com as regras novas
  Object.assign(
    ATTR_DEFS.find((a) => a.id === "forca")!,
    { desc: "Dano corpo a corpo (+6% por ponto acima de 5) · carga do arco um pouco mais rápida" },
  );
  Object.assign(
    ATTR_DEFS.find((a) => a.id === "constituicao")!,
    { desc: "HP máximo (+6 por ponto) · tira um pouco de cada golpe recebido · regeneração de HP e mana" },
  );
  Object.assign(
    ATTR_DEFS.find((a) => a.id === "destreza")!,
    { desc: "Crítico (2% + 1% por ponto) · dano do arco (+5% por ponto acima de 5) · bônus no alvo marcado" },
  );
  Object.assign(
    ATTR_DEFS.find((a) => a.id === "velocidade")!,
    { desc: "Velocidade de ataque (+3% por ponto acima de 5) e de movimento" },
  );
}
