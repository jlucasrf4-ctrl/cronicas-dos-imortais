/* ==== v7.7 — Caçador animado (esqueleto do Tripo/Mixamo, src/assets/models/cacador_anim.json) ====
   Na cena inicial e no acampamento: parada e andar, pelo motor de animado.ts; dormindo, a pose final da queda
   (deitado de costas). Arco na mão esquerda (mirando) ou nas costas. Mirar e carregar o javali ainda não têm
   animação: ele fica na pose parada/andando, com o arco à frente ou o javali acima da cabeça (cena.ts). */
import { M4 } from "./geometria.ts";
import { novoAnimado, animar, preso, aoLongo, comPos, trocarPele, type SituacaoAnim } from "./animado.ts";
import { duracaoClip, juntaGlobal, type DadosAnim, type MatrizesPose } from "./esqueleto.ts";
import { arcoNasCostas, dadosHeroina } from "./heroina_anim.ts";

// o marcador precisa de `{}` logo depois do comentário (o plugin troca os dois pelo JSON); nos testes em Node fica vazio
const DADOS = /* @inline-json src/assets/models/cacador_anim.json */ {} as DadosAnim;
/** Dados para a prévia do Caçador com suas próprias animações. */
export function dadosCacador() {
  return DADOS;
}

const CACADOR = novoAnimado(
  DADOS,
  {
    passoAndar: 90, // 1,48 do .glb por ciclo × 46,6 × 1,3
    passoCorrer: 178,
    rolarDur: 0.6,
    coletarDur: 0.8,
    troca: 0.2,
  },
  (G) => ({
    arco: { junta: "LeftHand", repouso: comPos(M4.RX(0.1), aoLongo(G("LeftHand"), 3)) },
    escudo: { junta: "LeftForeArm", repouso: comPos(M4.RY(-0.15), aoLongo(G("LeftHand"), 2)) },
    costas: { junta: "Spine2", repouso: M4.id() },
    arma: { junta: "RightHand", repouso: comPos(M4.RZ(-Math.PI / 2), aoLongo(G("RightHand"), 3)) },
  }),
);
// O parceiro de treino usa os clips de combate da heroína e a malha do Caçador.
// Os dois rigs têm as mesmas 22 juntas, na mesma ordem (Mixamo), então golpes,
// esquiva e guarda podem usar as mesmas animações do personagem do jogador.
const CACADOR_PVP = novoAnimado(
  dadosHeroina(),
  { passoAndar: 80, passoCorrer: 158, rolarDur: 0.6, coletarDur: 0.8, troca: 0.15 },
  (G) => ({
    arco: { junta: "LeftHand", repouso: comPos(M4.RX(0.1), aoLongo(G("LeftHand"), 3)) },
    escudo: { junta: "LeftForeArm", repouso: comPos(M4.RY(-0.15), aoLongo(G("LeftHand"), 2)) },
    costas: { junta: "Spine2", repouso: M4.id() },
    arma: { junta: "RightHand", repouso: comPos(M4.RZ(-Math.PI / 2), aoLongo(G("RightHand"), 3)) },
  }),
);
let CACADOR_PVP_VESTIDO = false;
let CACADOR_PVP_T = 0;
/** Último quadro desenhado (o Caçador não tem dt próprio: mede pelo relógio e pela posição). */
const ULT = { t: 0, x: 0, y: 0 };

/**
 * Avança e deforma o Caçador em (x, y) do mundo. `deitado`: dormindo (a pose final da queda).
 * Devolve a malha e as matrizes, ou null sem animação (o chamador usa o Caçador de peças).
 */
export function cacadorAnimado(x: number, y: number, opc: { andando?: boolean; deitado?: boolean }) {
  const agora = performance.now() / 1000,
    dt = ULT.t ? Math.min(0.1, Math.max(0, agora - ULT.t)) : 1 / 60;
  let andou = ULT.t ? Math.hypot(x - ULT.x, y - ULT.y) : 0;
  if (andou > 30) andou = 0; // pulou de lugar (outra cena)
  ULT.t = agora;
  ULT.x = x;
  ULT.y = y;
  if (!CACADOR.tentou || CACADOR.A)
    return animar(CACADOR, {
      dt,
      andou,
      movendo: opc.andando ? 1 : 0,
      fixo: opc.deitado && CACADOR.A ? { clip: "morrer", t: duracaoClip(CACADOR.A, "morrer") } : undefined,
    });
  return null;
}
/** Caçador com os clips de combate do jogador, para o duelo humano da área de testes. */
export function cacadorPvpAnimado(s: Omit<SituacaoAnim, "dt">) {
  if (!CACADOR_PVP_VESTIDO) {
    trocarPele(CACADOR_PVP, DADOS);
    CACADOR_PVP_VESTIDO = true;
  }
  const agora = performance.now() / 1000,
    dt = CACADOR_PVP_T ? Math.min(0.1, Math.max(0, agora - CACADOR_PVP_T)) : 1 / 60;
  CACADOR_PVP_T = agora;
  return animar(CACADOR_PVP, { ...s, dt });
}
/** Matriz (espaço do Caçador) de uma peça presa: "arco" (mão esquerda) ou "costas". */
export function cacadorPreso(mat: MatrizesPose, onde: "arco" | "costas" | "arma" | "escudo") {
  return preso(CACADOR, mat, onde);
}
/** Matriz de arma presa ao rig de combate do parceiro de treino. */
export function cacadorPvpPreso(mat: MatrizesPose, onde: "arco" | "costas" | "arma" | "escudo") {
  return preso(CACADOR_PVP, mat, onde);
}
/** Arma corpo a corpo presa à mão direita do Caçador. */
export function cacadorArma(mat: MatrizesPose) {
  return preso(CACADOR, mat, "arma");
}
/** v8.0 — o arco guardado nas costas do Caçador, encostado no corpo dele (depois de cacadorPreso(…, "costas")). */
export function cacadorArcoNasCostas() {
  return arcoNasCostas(CACADOR);
}
/** Centro do corpo (x, z no espaço do Caçador): para pôr o Caçador deitado em cima do colchonete. */
export function cacadorCentro(mat: MatrizesPose) {
  const g = juntaGlobal(CACADOR.A!, mat, "Spine1")!;
  return [g[12], g[14]] as const;
}
