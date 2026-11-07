/* ==== v7.7 — abertura Voidd: toca a vinheta do Voodi (src/intro/voidd.ts) ao abrir o jogo ====
   Roda antes de iniciarMeta (que abre a tela de título): a vinheta fica por cima, e a tela de título já está pronta
   embaixo quando ela sai. No build de teste (dist/vtest.html) só tira a capa de carregamento: os testes de navegador
   começam na tela de título (e tocam a vinheta pelo gancho, __t.tocarVinhetaVoidd). */
import { tocarVinhetaVoidd } from "../../intro/voidd.ts";

export function iniciarVoidd() {
  if (import.meta.env.MODE === "test") document.documentElement.classList.add("voidd-pronto");
  else tocarVinhetaVoidd(() => {});
}
