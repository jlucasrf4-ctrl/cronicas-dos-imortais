/* ==== v7.7 — heroína animada no campo (esqueleto do Tripo/Mixamo, src/assets/models/heroina_anim.json) ====
   Parada, andar, correr, coletar (agacha ao pegar um item do chão), rolar (cambalhota do dash do arco) e morrer, pelo
   motor de animado.ts. Arma na mão direita, escudo no antebraço esquerdo, arco na mão esquerda ou nas costas, com a
   orientação que têm na heroína de peças. Golpe, defesa, mira do arco, lança com as duas mãos e montaria ainda usam a
   heroína de peças (renderer.ts), até haver animações para eles. */
import { M4, type Mat4 } from "./geometria.ts";
import { HEROINA, centroEscudo } from "./heroina.ts";
import {
  novoAnimado,
  animar,
  prenderMaosNaArma,
  animarNoInstanteDe,
  coletar,
  preso,
  presoNoCombo,
  aoLongo,
  comPos,
  corDaJunta,
  trocarPele,
  encosto,
  type SituacaoAnim,
} from "./animado.ts";
import { MB, mbCyl, mbIco, glMesh } from "./malhas.ts";
import { armaPontos, ESCUDO_COSTAS } from "./armas3d.ts";
import { GL3 } from "../../core/state.ts";
import type { Anim, DadosAnim, MatrizesPose } from "./esqueleto.ts";

// o marcador precisa de `{}` logo depois do comentário (o plugin troca os dois pelo JSON); nos testes em Node fica vazio
const DADOS = /* @inline-json src/assets/models/heroina_anim.json */ {} as DadosAnim;

/** v8.0 — onde o centro do escudo fica no antebraço esquerdo: 0 = cotovelo, 1 = pulso. */
const ESCUDO = { aoLongo: 0.45 };

const AJUSTES = {
  passoAndar: 80, // 1,48 do .glb por ciclo × 41,4 × 1,3
  passoCorrer: 158,
  rolarDur: 0.6, // o dash do arco dura 0,3 s; ela termina de levantar depois
  coletarDur: 0.8,
  troca: 0.15,
  paradaRelaxada: true,
};
const PRESOS: Parameters<typeof novoAnimado>[2] = (G) => {
  const { ombroY: OY, ombroZ: OZ, mao: MAO } = HEROINA;
  const arma = M4.ch(M4.T(0, OY, OZ), M4.RZ(0.35), M4.T(MAO[0], MAO[1], MAO[2]));
  // v8.0: o escudo desliza ao longo do antebraço até o centro ficar em ESCUDO.aoLongo (0 = cotovelo, 1 = pulso);
  // antes o centro caía perto da mão e o braço parecia segurá-lo por baixo. A distância para fora do braço fica.
  const esc0 = M4.ch(M4.T(0, OY, -OZ), M4.RZ(0.2)),
    c0 = M4.ap(esc0, ...(centroEscudo() as [number, number, number])),
    F = G("LeftForeArm"),
    H = G("LeftHand"),
    u = [H[12] - F[12], H[13] - F[13], H[14] - F[14]],
    lu = Math.hypot(u[0], u[1], u[2]) || 1,
    k = ((F[12] - c0[0]) * u[0] + (F[13] - c0[1]) * u[1] + (F[14] - c0[2]) * u[2]) / lu + ESCUDO.aoLongo * lu;
  return {
    arma: { junta: "RightHand", repouso: comPos(arma, aoLongo(G("RightHand"), 3)) },
    escudo: { junta: "LeftForeArm", repouso: M4.ch(M4.T((u[0] / lu) * k, (u[1] / lu) * k, (u[2] / lu) * k), esc0) },
    arco: { junta: "LeftHand", repouso: comPos(M4.RZ(-0.3), aoLongo(G("LeftHand"), 3)) },
    costas: { junta: "Spine2", repouso: M4.id() },
    palmaD: { junta: "RightHand", repouso: comPos(M4.id(), aoLongo(G("RightHand"), 3)) }, // corda e flecha
    palmaE: { junta: "LeftHand", repouso: comPos(M4.id(), aoLongo(G("LeftHand"), 3)) }, // lança com as duas mãos
  };
};
const HEROI = novoAnimado(DADOS, AJUSTES, PRESOS);
const ROUPA_PEITO = novoAnimado(DADOS, { ...AJUSTES }, PRESOS);
const ROUPA_PERNAS = novoAnimado(DADOS, { ...AJUSTES }, PRESOS);
const ROUPA_PES = novoAnimado(DADOS, { ...AJUSTES }, PRESOS);
let TEM_ROUPA_PEITO = false,
  TEM_ROUPA_PERNAS = false,
  TEM_ROUPA_PES = false;
/** v8.1 — outro animado no esqueleto e nos clips da heroína, com as mesmas peças presas: cada bandido tem o seu
    (field/bandidos.ts; vestido com trocarPele). */
export function novoComoHeroina() {
  return novoAnimado(DADOS, { ...AJUSTES }, PRESOS);
}

/** Avança e deforma a heroína (null sem animação: o renderer usa a heroína de peças). */
export function heroinaAnimada(
  s: SituacaoAnim,
  pegada?: (mat: MatrizesPose) => { arma: Mat4; duasMaos: boolean } | null,
) {
  let corpo = animar(HEROI, s);
  if (!corpo) return null;
  const alvo = pegada?.(corpo.mat);
  if (alvo) corpo = prenderMaosNaArma(HEROI, alvo.arma, alvo.duasMaos) ?? corpo;
  return {
    ...corpo,
    roupaPeito: TEM_ROUPA_PEITO ? (animarNoInstanteDe(ROUPA_PEITO, HEROI, s)?.mesh ?? null) : null,
    roupaPernas: TEM_ROUPA_PERNAS ? (animarNoInstanteDe(ROUPA_PERNAS, HEROI, s)?.mesh ?? null) : null,
    roupaPes: TEM_ROUPA_PES ? (animarNoInstanteDe(ROUPA_PES, HEROI, s)?.mesh ?? null) : null,
  };
}
/** O estado atual da heroína animada ("parada", "atingido", "escudo_bloqueio"…): para os testes. */
export function heroinaEstado() {
  return HEROI.estado;
}
/** v8.0 — a heroína com a malha de outro personagem do mesmo esqueleto (null = ela mesma): a sala de treino
    (vestidos.ts). */
export function vestirHeroina(dados: DadosAnim | Anim | null) {
  trocarPele(HEROI, dados);
}
/** Peças de roupa animadas separadas sobre o corpo-base. */
export function vestirHeroinaPecas(
  peito: DadosAnim | Anim | null,
  pernas: DadosAnim | Anim | null,
  pes: DadosAnim | Anim | null = null,
) {
  TEM_ROUPA_PEITO = !!peito;
  TEM_ROUPA_PERNAS = !!pernas;
  TEM_ROUPA_PES = !!pes;
  trocarPele(ROUPA_PEITO, peito);
  trocarPele(ROUPA_PERNAS, pernas);
  trocarPele(ROUPA_PES, pes);
}
/** v8.1 — a matriz de pele da junta `nome` na pose atual (vestida: a do corpo dela): leva um ponto da malha em repouso
    ao espaço do modelo, como deformarMalha (as fitas das deusas, renderer.ts). null antes de animar. */
export function peleNaJunta(nome: string) {
  const A = HEROI.pele ?? HEROI.A,
    m = HEROI.pele ? HEROI.matP : HEROI.mat,
    j = A ? A.juntas.indexOf(nome) : -1;
  return m && j >= 0 ? m.skin.subarray(j * 16, j * 16 + 16) : null;
}
/** v8.1 — a malha em repouso que a heroína veste agora (a dela, sem vestido): o contorno das fitas das deusas. */
export function corpoDaHeroina() {
  return HEROI.pele ?? HEROI.A;
}
/** v8.1 — os vértices dela deformados no último quadro (espaço do modelo; null antes de animar). */
export function verticesDaHeroina() {
  return HEROI.V;
}
/** v8.0 — os dados da heroína (clips): os manequins da sala de treino posam com eles (vestidos.ts). */
export function dadosHeroina() {
  return DADOS;
}
/** E pegou um item do chão: agacha (chamado por collectLoot). */
export function heroinaColetar() {
  coletar(HEROI);
  if (TEM_ROUPA_PEITO) coletar(ROUPA_PEITO);
  if (TEM_ROUPA_PERNAS) coletar(ROUPA_PERNAS);
  if (TEM_ROUPA_PES) coletar(ROUPA_PES);
}
/* v8.0 — as peças guardadas e o escudo no braço encostados no corpo de quem a heroína veste (encosto em animado.ts;
   mantenedor 2026-10-25: "o arco não fica no corpo, flutua perto dele", "aplique em tudo que flutuar"). Amostras =
   pontos da face de dentro de cada peça (as malhas de modelos.ts), no espaço da peça presa. */
const ENCOSTAR = { folga: 0.3 };
const ARCO_COSTAS = { base: M4.ch(M4.T(-6.4, 24, 0), M4.RX(0.55), M4.S(0.85)) };
/** O arco antigo (P.bowOnly feito por código): hastes de raio 0,7 em x = −3t², empunhadura de raio 1,1 em x = 0. */
function amostrasArcoAntigo() {
  const pts: number[][] = [];
  for (let i = -10; i <= 10; i++) {
    const t = i / 10;
    pts.push(M4.ap(ARCO_COSTAS.base, -3 * t * t + 0.7, 13 * t - 1.3, 0));
  }
  for (const y of [-2, 0, 2]) pts.push(M4.ap(ARCO_COSTAS.base, 1.1, y - 0.1, 0));
  return pts;
}
/** Pontos de um disco (centro c, raio r) no plano perpendicular ao eixo `eixo` (0 = x, 2 = z). */
function disco(c: number[], r: number, eixo: 0 | 2) {
  const pts: number[][] = [c];
  for (const rr of [r * 0.5, r])
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2,
        u = Math.cos(a) * rr,
        v = Math.sin(a) * rr;
      pts.push(eixo === 0 ? [c[0], c[1] + u, c[2] + v] : [c[0] + u, c[1] + v, c[2]]);
    }
  return pts;
}
/* as amostras: os vértices das armas desenhadas (armas3d.ts), no lugar onde cada uma é desenhada; sem os dados, as
   formas das malhas antigas (o disco do escudo: raio 5,5 com a face de dentro em x = −5,6 nas costas; raio 6,3 com a
   borda em z = ez + 0,2 no braço). Calculadas uma vez. */
const AMOSTRAS = new Map<string, number[][]>();
function amostras(chave: string, faz: () => number[][]) {
  let a = AMOSTRAS.get(chave);
  if (!a) AMOSTRAS.set(chave, (a = faz()));
  return a;
}
/** O arco guardado nas costas (depois de presoEm(…, "costas")); `X` = outro animado com a peça "costas" (o Caçador);
    `arco` = a chave do arco (o longo tem outro desenho). */
export function arcoNasCostas(X: Parameters<typeof encosto>[0] = HEROI, arco = "eq_arco") {
  const am = amostras(arco, () => armaPontos(arco, ARCO_COSTAS.base) ?? amostrasArcoAntigo());
  const d = encosto(X, "costas", arco, am, [1, 0, 0], ENCOSTAR.folga);
  return M4.ch(M4.T(d, 0, 0), ARCO_COSTAS.base);
}
/** O escudo guardado nas costas, com o arco na mão (depois de presoEm(…, "costas")). */
export function escudoNasCostas() {
  const am = amostras("escudo_costas", () => armaPontos("eq_escudo", ESCUDO_COSTAS) ?? disco([-5.6, 24, 0], 5.5, 0));
  return M4.T(encosto(HEROI, "costas", "escudo_costas", am, [1, 0, 0], ENCOSTAR.folga), 0, 0);
}
/** O escudo no antebraço esquerdo (depois de presoEm(…, "escudo")): anda em z até a borda de dentro encostar no braço. */
export function escudoNoBraco(X: Parameters<typeof encosto>[0] = HEROI) {
  const am = amostras("escudo", () => {
    const [ex, , ez] = centroEscudo();
    return armaPontos("eq_escudo", M4.T(ex, -8.5, ez)) ?? disco([ex, -8.5, ez + 0.2], 6.3, 2);
  });
  return M4.T(0, 0, encosto(X, "escudo", "escudo", am, [0, 0, 1], ENCOSTAR.folga));
} /** Matriz (espaço do herói) de uma peça presa: "arma", "escudo", "arco", "costas". */
export function presoEm(mat: MatrizesPose, onde: "arma" | "escudo" | "arco" | "costas" | "palmaD") {
  return preso(HEROI, mat, onde);
}
/** v7.7 — a lança na estocada (clip de baioneta, duas mãos): a haste sai da palma direita (atrás) e passa pela
    esquerda (à frente), como na heroína de peças, em vez de girar com o pulso direito. w = 0..1 mistura com a lança
    presa à mão direita (entrada e saída do golpe, sem salto). Espaço do herói. */
export function lancaDuasMaos(mat: MatrizesPose, w: number) {
  const W = preso(HEROI, mat, "arma");
  if (w <= 0) return W;
  const R = preso(HEROI, mat, "palmaD"),
    L = preso(HEROI, mat, "palmaE"),
    n = Math.hypot(L[12] - R[12], L[13] - R[13], L[14] - R[14]) || 1,
    na = Math.hypot(W[0], W[1], W[2]) || 1,
    dx = W[0] / na + ((L[12] - R[12]) / n - W[0] / na) * w,
    dy = W[1] / na + ((L[13] - R[13]) / n - W[1] / na) * w,
    dz = W[2] / na + ((L[14] - R[14]) / n - W[2] / na) * w;
  return M4.ch(
    M4.T(W[12] + (R[12] - W[12]) * w, W[13] + (R[13] - W[13]) * w, W[14] + (R[14] - W[14]) * w),
    M4.RY(-Math.atan2(dz, dx)),
    M4.RZ(Math.atan2(dy, Math.hypot(dx, dz))),
  );
}
/** v8.0 — a lança na mira do arremesso: sai da palma direita (erguida acima do ombro) para a frente, um pouco para
    cima e para dentro (a direção `LANCA_MIRA`: frente, cima, para fora), como na heroína de peças. Espaço do herói. */
const LANCA_MIRA = [10, 1.8, -0.6];
export function lancaNaMira(mat: MatrizesPose) {
  const R = preso(HEROI, mat, "palmaD"),
    [dx, dy, dz0] = LANCA_MIRA,
    dz = dz0 * (R[14] >= 0 ? 1 : -1);
  return M4.ch(M4.T(R[12], R[13], R[14]), M4.RY(-Math.atan2(dz, dx)), M4.RZ(Math.atan2(dy, Math.hypot(dx, dz))));
}
/** v8.0 — o punho fechado em volta do cabo da lança (o esqueleto não tem dedos: sem ele o cabo parecia fincado na
    mão). Na cor da mão do modelo, no mesmo lugar e eixo da lança (a pegada na origem, o cabo ao longo de +x): a palma,
    quatro dedos dobrados (anéis em volta do cabo) e o polegar por cima. `PUNHO`: tamanhos em unidades do modelo. */
const PUNHO = { palma: [3.2, 2.2, 2.4], dedo: 2.1, largDedo: 0.62, passo: 0.72, polegar: [1.6, 1, 1.1] };
export function punhoLanca() {
  if (GL3.mesh.punhoLanca) return GL3.mesh.punhoLanca;
  const cor = corDaJunta(HEROI, "RightHand");
  if (!cor) return null;
  const b = MB(),
    P = PUNHO,
    escuro = cor.map((v) => v * 0.85);
  mbIco(b, M4.ch(M4.T(0, -0.2, 0.35), M4.S(P.palma[0], P.palma[1], P.palma[2])), cor, 1, 0, 0);
  for (let i = 0; i < 4; i++)
    mbCyl(
      b,
      M4.ch(M4.T((i - 1.5) * P.passo - P.largDedo / 2, 0, 0), M4.RZ(-Math.PI / 2), M4.S(P.dedo, P.largDedo, P.dedo)),
      i % 2 ? cor : escuro,
      8,
      1,
    );
  mbIco(b, M4.ch(M4.T(1.5, 0.75, -0.3), M4.RZ(-0.5), M4.S(P.polegar[0], P.polegar[1], P.polegar[2])), cor, 1, 0, 0);
  const m = glMesh(b);
  m.ol = true;
  return (GL3.mesh.punhoLanca = m);
}
/** A arma (espaço do herói) no instante g (s) do passo do combo: o rastro da espada (null sem o clip). */
export function armaNoCombo(passo: number, g: number) {
  return presoNoCombo(HEROI, passo, g, "arma");
}
