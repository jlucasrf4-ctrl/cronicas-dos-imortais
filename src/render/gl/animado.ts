/* ==== v7.7 — personagem animado por esqueleto (heroína, Caçador): estados, mistura, malha deformada na GPU ====
   Um "animado" é um modelo com animações (src/assets/models/<nome>_anim.json, gerado por tools/gerar-animacoes.ts)
   mais o estado de quem o usa. Estados: parada, andar, correr (no ritmo do passo: o pé não escorrega), rolar
   (cambalhota), morrer (queda), ou uma pose fixa (um clip num instante, ex.: deitado). "coletar" agacha por cima do
   estado por um instante. A troca de estado mistura as poses. A malha é deformada na CPU (esqueleto.ts) e vai para
   buffers dinâmicos com as mesmas entradas de glMesh (posição, normal lisa, cor, normal do contorno): luz, sombra e
   contorno funcionam como nas outras malhas. Peças (arma, escudo, arco) presas às juntas por uma correção medida na
   pose parada. ==== */
import { GL3 } from "../../core/state.ts";
import { M4, SMOOTH_COS, type Mat4 } from "./geometria.ts";
import {
  decodificarAnim,
  novaPose,
  poseClip,
  misturarPoses,
  matrizesPose,
  girarJunta,
  deformarMalha,
  normaisSuaves,
  duracaoClip,
  juntaGlobal,
  type Anim,
  type DadosAnim,
  type MalhaDeformada,
  type MatrizesPose,
  type Pose,
} from "./esqueleto.ts";
import type { GLMesh } from "../../core/tipos.ts";

/** Ajustes de um animado (distâncias em unidades do mundo, tempos em segundos). */
interface AjustesAnim {
  passoAndar: number; // quanto anda num ciclo do "andar"
  passoCorrer: number; // idem, "correr"
  rolarDur: number; // a cambalhota inteira
  coletarDur: number; // agachar e levantar
  troca: number; // mistura entre estados
  paradaRelaxada?: boolean; // braços soltos na parada humana, incluindo a prévia
}
/** Uma peça presa: a junta e a matriz (espaço do modelo) que a peça tem na pose parada. */
type Presos = (G: (junta: string) => Float32Array) => Record<string, { junta: string; repouso: Mat4 }>;

/** Situação do personagem neste quadro. */
export interface SituacaoAnim {
  dt: number;
  andou: number; // distância andada neste quadro (mundo)
  correndo?: number; // 0..1
  movendo?: number; // 0..1
  rolando?: boolean;
  debilitado?: boolean; // caminhada ferida, volta ao normal ao sair do estado
  morto?: boolean;
  fixo?: { clip: string; t: number }; // pose fixa (ignora o resto)
  modo?: "arco" | "faca" | "combate" | ""; // a parada muda com a arma ou alvo fixado
  carga?: number; // arco: 0..1 sacando a flecha (puxar) — 1 = mirando
  mirando?: boolean; // arco: segurando a corda
  soltando?: boolean; // arco: acabou de atirar
  dirMov?: number; // direção do movimento em relação à frente (rad; 0 = frente, +π/2 = esquerda)
  golpe?: number | null; // lança: tempo desde o início do golpe (s)
  combo?: { passo: number; t: number } | null; // espada/machado/clava: passo do combo (0, 1, 2 = finalizador) e tempo (s)
  machadoCarga?: number | null; // 0..1: prepara e mantém o machado erguido
  machadoGolpe?: number | null; // 0..1: descida depois de soltar o botão direito
  guarda?: boolean; // escudo levantado (anda de lado)
  aparo?: number | null; // tempo desde a tentativa de parry, inclusive sem manter a guarda
  aparoPerfeito?: number | null; // tempo desde a confirmação do parry perfeito
  atingido?: number | null; // v7.7: tempo desde que levou dano (s), enquanto dura a reação (REACAO.atingido)
  bloqueou?: number | null; // v7.7: tempo desde que o escudo segurou um golpe (s)
  miraLanca?: number | null; // v8.0: mirando o arremesso da lança: a carga 0..1 (null = não está mirando)
  derrubada?: { t: number; dur: number } | null; // v8.1: derrubada (javali): tempo desde o golpe e quanto dura (s)
}

/** Golpe de lança: o trecho da "baioneta" (ini → pico → fim, em s do clip) no tempo do golpe do jogo. */
const LANCA = { clip: "lanca_baioneta", ini: 0.81, pico: 1.22, fim: 1.9, tPico: 0.08, tFim: 0.38 };
/** v7.7 — combo de espada/machado/clava (pacote Sword and Shield): por passo, o clip e o pico do golpe (s do clip,
    a mão direita mais rápida); `antes`/`depois` = o trecho em volta do pico; tPico = quando o jogo acerta (s, igual
    ao comboPose do renderer) e tFim = fim do golpe no jogo (GL3.atk some aos 0,38 s). */
const COMBO = {
  passos: [
    { clip: "espada_0", pico: 0.6 },
    { clip: "espada_1", pico: 0.65 },
    { clip: "espada_2", pico: 0.63 },
  ],
  antes: 0.4,
  depois: 0.5,
  tPico: [0.16, 0.16, 0.2],
  tFim: 0.38,
};
/** v7.7 — reações (pacote Sword and Shield): quanto duram no jogo (s); o clip inteiro é tocado nesse tempo. */
const REACAO = { atingido: 0.45, bloqueio: 0.5 };
/** Combo: o instante do clip no tempo g do golpe do jogo (o mesmo mapeamento da lança: preparo até o pico no tempo
    do acerto, depois o resto até o fim). */
function tempoCombo(i: number, g: number) {
  const P = COMBO.passos[i],
    tp = COMBO.tPico[i];
  return g < tp
    ? P.pico - COMBO.antes + (g / tp) * COMBO.antes
    : P.pico + Math.min(1, (g - tp) / (COMBO.tFim - tp)) * COMBO.depois;
}
/** v8.1 — clips do boneco genérico do Mixamo (mantenedor, 2026-10-31). Derrubada (Scissor Kick a partir do voo): o
    trecho até bater no chão (`queda`, s do clip) toca em `tQueda` s do jogo, o resto (deitada e levantando) no que
    sobra da derrubada. Recuar (Step Backward, passo de guarda para trás em laço): só o quadril e as pernas; do tronco
    para cima segue a guarda da arma (o clip vem com os punhos de boxe); `passo` = quanto anda num ciclo (mundo).
    Mira da lança (Sword Fight One, a guarda baixa): o corpo parado mirando, por baixo do IK dos braços (MIRA_LANCA). */
const DERRUBADA = { clip: "derrubada", queda: 0.75, tQueda: 0.4 };
const RECUAR = {
  clip: "recuar",
  passo: 21,
  cima: ["Spine", "Spine1", "Spine2", "Neck", "Head", "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand"].concat([
    "RightShoulder",
    "RightArm",
    "RightForeArm",
    "RightHand",
  ]),
};
const LANCA_MIRA = "lanca_mira";
/** Arco: quanto dura o "soltar" depois do tiro (s) e a velocidade dele. */
const SOLTAR = { dur: 0.5, vel: 1.4 };
/** v8.0 — mira do arremesso da lança, por cima do andar/parada (só os braços e o tronco; as pernas seguem o clip).
    Alvos das mãos a partir do ombro, em comprimentos do braço, [frente, cima, para fora do corpo]: `maoD` erguida
    acima e atrás do ombro (+ `recuo` para trás com a carga cheia), `maoE` apontando para a frente; `poloD`/`poloE` =
    para onde o cotovelo aponta (mesmos eixos; `poloRecuo` = o cotovelo vai para trás com a carga); `giro` = o tronco
    vira (rad, ombro direito para trás) com a carga; `pesoE` = quanto o braço esquerdo segue a pose [parada, andando]
    (o resto é o balanço do clip); `balanco` = respiração (rad/s; amplitudes em comprimentos do braço, mão direita e
    esquerda); `entra`/`sai` = s para a pose entrar e sair. */
const MIRA_LANCA = {
  maoD: [-0.45, 0.3, 0.38],
  recuo: [-0.2, 0.02, 0.04],
  maoE: [0.62, -0.18, -0.08],
  poloD: [-0.15, -0.3, 1],
  poloRecuo: [-0.6, 0, 0],
  poloE: [-0.2, -1, 0.5],
  giro: 0.35,
  pesoE: [0.85, 0.45],
  balanco: { vel: 1.7, maoD: 0.03, maoE: 0.07 },
  entra: 0.12,
  sai: 0.1,
};

/** Centro da malha da mão em bind; os eixos do osso nem sempre seguem os dedos. */
const CENTROS_MAOS = new WeakMap<Anim, Map<number, number[] | null>>();
function centroDaMao(A: Anim, j: number) {
  let centros = CENTROS_MAOS.get(A);
  if (!centros) CENTROS_MAOS.set(A, (centros = new Map()));
  if (centros.has(j)) return centros.get(j)!;
  const c = [0, 0, 0];
  let total = 0;
  for (let v = 0; v < A.P.length / 3; v++) {
    let w = 0;
    for (let k = 0; k < 4; k++) if (A.J[v * 4 + k] === j) w += A.W[v * 4 + k];
    if (w < 0.6) continue;
    for (let e = 0; e < 3; e++) c[e] += A.P[v * 3 + e] * w;
    total += w;
  }
  if (total) for (let e = 0; e < 3; e++) c[e] /= total;
  centros.set(j, total ? c : null);
  return total ? c : null;
}
/** Repouso humano: ajusta o corpo vestido antes da mistura entre movimentos.
 * Mantém a respiração do clip e mede a direção dos dedos na própria malha. */
function relaxarParada(A: Anim, pose: Pose, pele: Anim) {
  const p =
    pele === A
      ? pose
      : {
          r: pose.r,
          q: Float32Array.from(pose.q, (v) => (v * pele.repouso[1]) / (A.repouso[1] || 1)),
        };
  const m = matrizesPose(pele, p);
  for (const lado of ["Left", "Right"]) {
    const jA = pele.juntas.indexOf(lado + "Arm"),
      jF = pele.juntas.indexOf(lado + "ForeArm"),
      jH = pele.juntas.indexOf(lado + "Hand");
    if (jA < 0 || jF < 0 || jH < 0) continue;
    const ombro = _pos(m, jA),
      cotovelo = _pos(m, jF),
      mao = _pos(m, jH),
      comp = _len(_sub(cotovelo, ombro)) + _len(_sub(mao, cotovelo)),
      sinal = ombro[2] >= 0 ? 1 : -1;
    bracoIK(
      pele,
      p,
      m,
      lado,
      [ombro[0] + comp * 0.08, ombro[1] - comp * 0.94, ombro[2] + sinal * comp * 0.2],
      // Frente = +x: cotovelo atrás do punho, flexão no perfil em vez de abrir de lado.
      [-1, -0.1, sinal * 0.06],
      1,
    );
    const c = centroDaMao(pele, jH);
    if (!c) continue;
    const h = jH * 16,
      skin = m.skin;
    const centro = [0, 1, 2].map(
      (e) => skin[h + e] * c[0] + skin[h + 4 + e] * c[1] + skin[h + 8 + e] * c[2] + skin[h + 12 + e],
    );
    // O punho acompanha o antebraço; apontar a mão para baixo força uma dobra artificial.
    girarPara(pele, p, m, jH, _sub(centro, _pos(m, jH)), _sub(_pos(m, jH), _pos(m, jF)), 1);
    matrizesPose(pele, p, m);
  }
}
const _sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const _dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const _len = (a: number[]) => Math.hypot(a[0], a[1], a[2]);
const _pos = (m: MatrizesPose, j: number) => [m.glob[j * 16 + 12], m.glob[j * 16 + 13], m.glob[j * 16 + 14]];
/** Gira a junta j para que a direção `de` vire `para` (espaço do jogo), × w. */
function girarPara(A: Anim, pose: Pose, m: MatrizesPose, j: number, de: number[], para: number[], w: number) {
  const ld = _len(de),
    lp = _len(para);
  if (ld < 1e-6 || lp < 1e-6) return;
  const c = Math.max(-1, Math.min(1, _dot(de, para) / (ld * lp))),
    eixo = [de[1] * para[2] - de[2] * para[1], de[2] * para[0] - de[0] * para[2], de[0] * para[1] - de[1] * para[0]];
  girarJunta(A, pose, m, j, eixo, Math.acos(c) * w);
}
/** IK de dois ossos: leva a mão (`lado` "Right"/"Left") a `alvo` com o cotovelo para `polo` (espaço do jogo), × w. */
function bracoIK(A: Anim, pose: Pose, m: MatrizesPose, lado: string, alvo: number[], polo: number[], w: number) {
  const jA = A.juntas.indexOf(lado + "Arm"),
    jF = A.juntas.indexOf(lado + "ForeArm"),
    jH = A.juntas.indexOf(lado + "Hand");
  if (jA < 0 || jF < 0 || jH < 0) return m;
  const S = _pos(m, jA),
    E = _pos(m, jF),
    L1 = _len(_sub(E, S)),
    L2 = _len(_sub(_pos(m, jH), E)),
    ST = _sub(alvo, S),
    d = Math.max(Math.abs(L1 - L2) + 1e-3, Math.min(L1 + L2 - 1e-3, _len(ST))),
    u = ST.map((v) => v / (_len(ST) || 1)),
    pd = _dot(polo, u),
    pp = polo.map((v, i) => v - u[i] * pd),
    pl = _len(pp) || 1,
    a = (L1 * L1 - L2 * L2 + d * d) / (2 * d),
    h = Math.sqrt(Math.max(0, L1 * L1 - a * a)),
    E2 = S.map((v, i) => v + u[i] * a + (pp[i] / pl) * h),
    T = S.map((v, i) => v + u[i] * d);
  girarPara(A, pose, m, jA, _sub(E, S), _sub(E2, S), w);
  matrizesPose(A, pose, m);
  const E3 = _pos(m, jF);
  girarPara(A, pose, m, jF, _sub(_pos(m, jH), E3), _sub(T, E3), w);
  return matrizesPose(A, pose, m);
}
/** A pose de mira da lança por cima de `pose` (peso w, carga ch, t = s mirando, mov = 0..1 andando). Eixos do modelo:
    frente +x, cima +y; o lado de cada braço sai da posição do ombro. */
function miraLanca(A: Anim, pose: Pose, m: MatrizesPose, w: number, ch: number, t: number, mov: number) {
  const M = MIRA_LANCA,
    jT = A.juntas.indexOf("Spine1");
  matrizesPose(A, pose, m);
  const jD = A.juntas.indexOf("RightArm");
  if (jT >= 0 && jD >= 0) {
    // em volta de +y, o ombro direito (lado zD) vai para trás com ângulo de sinal −zD
    const zD = _pos(m, jD)[2] >= 0 ? 1 : -1;
    girarJunta(A, pose, m, jT, [0, 1, 0], -zD * M.giro * w * (0.4 + 0.6 * ch));
    matrizesPose(A, pose, m);
  }
  for (const lado of ["Right", "Left"]) {
    const jA = A.juntas.indexOf(lado + "Arm"),
      jF = A.juntas.indexOf(lado + "ForeArm"),
      jH = A.juntas.indexOf(lado + "Hand");
    if (jA < 0 || jF < 0 || jH < 0) continue;
    const S = _pos(m, jA),
      L = _len(_sub(_pos(m, jF), S)) + _len(_sub(_pos(m, jH), _pos(m, jF))),
      fora = S[2] >= 0 ? 1 : -1,
      dir = lado === "Right",
      B = M.balanco,
      fase = t * B.vel,
      // respiração: a direita sobe e desce pouco; a esquerda balança solta (frente/trás e cima/baixo)
      bal = dir
        ? [0, Math.sin(fase) * B.maoD, 0]
        : [Math.sin(fase * 0.8 + 1) * B.maoE, Math.sin(fase + 0.6) * B.maoE * 0.6, 0],
      o = (dir ? M.maoD.map((v, i) => v + M.recuo[i] * ch) : M.maoE).map((v, i) => v + bal[i]),
      po = dir ? M.poloD.map((v, i) => v + M.poloRecuo[i] * ch) : M.poloE,
      alvo = [S[0] + o[0] * L, S[1] + o[1] * L, S[2] + o[2] * L * fora],
      pw = dir ? w : w * (M.pesoE[0] + (M.pesoE[1] - M.pesoE[0]) * mov);
    bracoIK(A, pose, m, lado, alvo, [po[0], po[1], po[2] * fora], pw);
  }
}

/** Arco: corrige a ancoragem da puxada para a mão direita chegar à altura da bochecha, com o cotovelo para trás. */
function miraArco(A: Anim, pose: Pose, m: MatrizesPose, w: number) {
  if (w <= 0) return;
  matrizesPose(A, pose, m);
  const jA = A.juntas.indexOf("RightArm"),
    jF = A.juntas.indexOf("RightForeArm"),
    jH = A.juntas.indexOf("RightHand"),
    jCabeca = A.juntas.indexOf("Head");
  if (jA < 0 || jF < 0 || jH < 0 || jCabeca < 0) return;
  const S = _pos(m, jA),
    cabeca = _pos(m, jCabeca),
    fora = S[2] >= 0 ? 1 : -1,
    L = _len(_sub(_pos(m, jF), S)) + _len(_sub(_pos(m, jH), _pos(m, jF))),
    alvo = [cabeca[0] - 0.16 * L, cabeca[1] - 0.16 * L, cabeca[2] + fora * 0.22 * L];
  bracoIK(A, pose, m, "Right", alvo, [-0.15, -0.25, fora], w);
}

/** Mantém o arco em pé e a pegada sobre a linha da flecha. A correção pertence ao punho,
 * então a mão, a arma e a roupa acompanham a mesma pose em qualquer rumo do personagem. */
function alinharArco(X: Animado, peso: number) {
  if (peso <= 0 || !X.K.arco || !X.K.palmaD || !X.A || !X.pose) return;
  const A = X.pele ?? X.A,
    pose =
      A === X.A
        ? X.pose
        : {
            r: X.pose.r,
            q: Float32Array.from(X.pose.q, (v) => (v * A.repouso[1]) / (X.A!.repouso[1] || 1)),
          },
    j = A.juntas.indexOf("LeftHand");
  if (j < 0) return;
  const m = matrizesPose(A, pose);
  const orientar = () => {
    let B = preso(X, m, "arco");
    girarPara(A, pose, m, j, [B[0], B[1], B[2]], [1, 0, 0], peso);
    matrizesPose(A, pose, m);
    B = preso(X, m, "arco");
    const x = [B[0], B[1], B[2]],
      l = _len(x) || 1,
      u = x.map((v) => v / l),
      cima = [-u[0] * u[1], 1 - u[1] * u[1], -u[2] * u[1]];
    girarPara(A, pose, m, j, [B[4], B[5], B[6]], cima, peso);
    matrizesPose(A, pose, m);
  };
  orientar();
  const B = preso(X, m, "arco"),
    D = preso(X, m, "palmaD"),
    H = _pos(m, j);
  // A flecha sai da palma direita para +x; a empunhadura deve estar nessa mesma linha.
  const ja = A.juntas.indexOf("LeftArm"),
    jf = A.juntas.indexOf("LeftForeArm");
  if (ja < 0 || jf < 0) return;
  const S = _pos(m, ja),
    E = _pos(m, jf),
    L = (_len(_sub(E, S)) + _len(_sub(H, E))) * 0.985,
    y = H[1] + D[13] - B[13],
    z = H[2] + D[14] - B[14],
    alcanceX = Math.sqrt(Math.max(0.001, L * L - (y - S[1]) ** 2 - (z - S[2]) ** 2));
  bracoIK(A, pose, m, "Left", [Math.min(H[0], S[0] + alcanceX), y, z], [0, -1, -0.2], peso);
  orientar();
}

interface Animado {
  dados: DadosAnim;
  aj: AjustesAnim;
  presos: Presos;
  A: Anim | null;
  tentou: boolean;
  estado: string;
  t: number;
  faseAndar: number;
  faseCorrer: number;
  faseRecuar?: number; // v8.1: ciclo do "recuar" (RECUAR)
  troca: number;
  coleta: number;
  coletaT: number;
  coletaPeso?: number; // v7.7: peso atual do agachar por cima (some rápido quando volta a andar)
  miraPeso?: number; // v8.0: peso atual da mira da lança por cima (MIRA_LANCA)
  miraCh?: number; // v8.0: a última carga da mira (a pose sai com ela)
  miraT?: number; // v8.0: tempo mirando (o balanço da respiração)
  ant: Pose | null;
  pose: Pose | null;
  base: Pose | null;
  aux: Pose | null;
  aux2?: Pose; // presoNoCombo
  mat2?: MatrizesPose;
  mat: MatrizesPose | null;
  def: MalhaDeformada | null;
  V: Float32Array | null;
  NS: Float32Array | null;
  HS: Float32Array | null;
  gl: WebGL2RenderingContext | null;
  mesh: GLMesh | null;
  bufs: WebGLBuffer[];
  K: Record<string, { j: string; m: Float32Array }>;
  /** v7.7: multiplica a cor da malha (r, g, b): a pelagem de cada lobo (bichos.ts); null = a cor do modelo */
  tom: number[] | null;
  /** v8.0: outra malha no mesmo esqueleto (vestidos.ts): a pose sai dos clips deste animado e deforma a dela */
  pele?: Anim | null;
  poseP?: Pose;
  matP?: MatrizesPose;
}
/** v7.7 — o modelo decodificado, compartilhado pelos animados com os mesmos dados (uma matilha de lobos decodifica uma vez) */
const DECODIFICADOS = new WeakMap<DadosAnim, Anim>();

export function novoAnimado(dados: DadosAnim, aj: AjustesAnim, presos: Presos): Animado {
  return {
    dados,
    aj,
    presos,
    A: null,
    tentou: false,
    estado: "parada",
    t: 0,
    faseAndar: 0,
    faseCorrer: 0,
    troca: 1,
    coleta: 0,
    coletaT: 0,
    ant: null,
    pose: null,
    base: null,
    aux: null,
    mat: null,
    def: null,
    V: null,
    NS: null,
    HS: null,
    gl: null,
    mesh: null,
    bufs: [],
    K: {},
    tom: null,
  };
}

/** Inversa de uma matriz rígida com escala uniforme. */
function inversa(m: Mat4) {
  const s2 = m[0] * m[0] + m[1] * m[1] + m[2] * m[2],
    o = new Float32Array(16);
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) o[c * 4 + r] = m[r * 4 + c] / s2;
  for (let r = 0; r < 3; r++) o[12 + r] = -(o[r] * m[12] + o[4 + r] * m[13] + o[8 + r] * m[14]);
  o[15] = 1;
  return o;
}

/** Ponto a `dist` da junta, ao longo do osso (y local): a palma, a partir da junta da mão. */
export function aoLongo(G: Mat4, dist: number) {
  const l = Math.hypot(G[4], G[5], G[6]) || 1,
    k = dist / l;
  return [G[12] + G[4] * k, G[13] + G[5] * k, G[14] + G[6] * k] as const;
}
/** A rotação de R com a posição p. */
export function comPos(R: Mat4, p: readonly number[]) {
  const m = Float32Array.from(R);
  m[12] = p[0];
  m[13] = p[1];
  m[14] = p[2];
  return m;
}

function carregar(X: Animado) {
  X.tentou = true;
  if (!X.dados.clips) return false;
  let A0 = DECODIFICADOS.get(X.dados);
  if (!A0) DECODIFICADOS.set(X.dados, (A0 = decodificarAnim(X.dados)));
  const A = (X.A = A0);
  X.pose = novaPose(A);
  X.base = novaPose(A);
  X.aux = novaPose(A);
  X.ant = novaPose(A);
  const m0 = matrizesPose(A, poseClip(A, "parada", 0, false));
  const G = (n: string) => juntaGlobal(A, m0, n)!;
  for (const [nome, p] of Object.entries(X.presos(G)))
    X.K[nome] = { j: p.junta, m: M4.mul(inversa(G(p.junta)), p.repouso) };
  return true;
}

/** v7.7 — troca o tom da malha (null = a cor do modelo); se a malha já existe, reenvia só as cores. */
export function trocarTom(X: Animado, tom: number[] | null) {
  if (X.tom === tom || (X.tom && tom && X.tom.every((v, i) => v === tom[i]))) return;
  X.tom = tom;
  if (!X.mesh || X.gl !== GL3.gl || !X.def) return;
  const gl = GL3.gl,
    c = X.def.c;
  gl.bindBuffer(gl.ARRAY_BUFFER, X.bufs[2]);
  gl.bufferData(gl.ARRAY_BUFFER, tom ? c.map((v, i) => Math.min(1, v * tom[i % 3])) : c, gl.STATIC_DRAW);
}

/** v8.0 — veste o animado com a malha de outro modelo do mesmo esqueleto (null = a dele): os clips continuam os dele,
    a malha, as juntas de repouso e as inversas de bind passam a ser as do outro (tools/juntar-vestidos.ts). Também
    aceita um modelo já montado (corpo + cabeça trocada, aparencias.ts). */
export function trocarPele(X: Animado, dados: DadosAnim | Anim | null) {
  let A: Anim | null = null;
  if (dados && "ini" in dados) A = dados;
  else if (dados) {
    A = DECODIFICADOS.get(dados) ?? null;
    if (!A) DECODIFICADOS.set(dados, (A = decodificarAnim(dados)));
  }
  if ((X.pele ?? null) === A) return;
  X.pele = A;
  // a malha na GPU e os buffers da deformação têm o tamanho da malha antiga
  if (X.gl && X.gl === GL3.gl && X.mesh?.vao) {
    for (const b of X.bufs) X.gl.deleteBuffer(b);
    X.gl.deleteVertexArray(X.mesh.vao);
  }
  X.mesh = null;
  X.bufs = [];
  X.def = null;
  X.V = null;
  X.NS = null;
  X.HS = null;
}

/** Agacha por um instante (pegar algo do chão). */
export function coletar(X: Animado) {
  if (X.coleta <= 0) X.coletaT = 0;
  X.coleta = X.aj.coletarDur;
}

function criarMalhaGL(X: Animado, def: MalhaDeformada, A: Anim) {
  const gl = GL3.gl,
    vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const tom = X.tom,
    cor = tom ? def.c.map((v, i) => Math.min(1, v * tom[i % 3])) : def.c;
  X.bufs = [def.p, def.n, cor, def.n].map((arr, loc) => {
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, arr, loc === 2 ? gl.STATIC_DRAW : gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    return buf;
  });
  // v8.0: com textura (as deusas), as coordenadas por canto no atributo 4, como os prédios da vila (vila_tex.ts)
  let tex: WebGLTexture | undefined;
  if (A.UV && A.tex) {
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, A.UV, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 2, gl.FLOAT, false, 0, 0);
    X.bufs.push(buf);
    tex = texturaDe(gl, A.tex);
  }
  gl.bindVertexArray(null);
  X.gl = gl;
  return (X.mesh = { vao, n: def.p.length / 3, ol: true, tex });
}
/** v8.0 — a textura de uma pele (uma por imagem e contexto; cinza-pele até a imagem carregar). */
const TEXTURAS = new Map<string, { gl: WebGL2RenderingContext; t: WebGLTexture }>();
function texturaDe(gl: WebGL2RenderingContext, url: string) {
  const ja = TEXTURAS.get(url);
  if (ja && ja.gl === gl) return ja.t;
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([220, 170, 135, 255]));
  gl.bindTexture(gl.TEXTURE_2D, null);
  const img = new Image();
  img.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
  };
  img.src = url;
  TEXTURAS.set(url, { gl, t });
  return t;
}

/**
 * Avança a animação e deforma a malha. Devolve a malha (espaço do modelo: pés em y=0, frente +x) e as matrizes
 * da pose, ou null se não há animação (testes em Node, JSON ausente) ou WebGL.
 */
export function animar(X: Animado, s: SituacaoAnim): { mesh: GLMesh; mat: MatrizesPose } | null {
  if (!X.tentou && !carregar(X)) return null;
  const A = X.A;
  if (!A || !GL3.gl) return null;
  const H = X.aj;
  const tem = (c: string) => !!A.clips[c],
    movendo = (s.movendo ?? 0) > 0.5;
  // andando mirando: frente, trás, esquerda ou direita, pela direção do movimento em relação à mira
  const dirArco = () => {
    const a = s.dirMov ?? 0,
      c = Math.cos(a),
      sn = Math.sin(a);
    return Math.abs(c) >= Math.abs(sn) ? (c >= 0 ? "arco_frente" : "arco_tras") : sn > 0 ? "arco_esq" : "arco_dir";
  };
  // v8.1: andando para trás em guarda (alvo fixado ou faca), sem correr: o passo de guarda (RECUAR)
  const recuando =
    movendo &&
    Math.cos(s.dirMov ?? 0) < -0.35 &&
    (s.correndo ?? 0) <= 0.5 &&
    (s.modo === "combate" || s.modo === "faca") &&
    tem(RECUAR.clip);
  let novo = "parada";
  if (s.fixo) novo = "fixo:" + s.fixo.clip;
  else if (s.morto) novo = "morrer";
  else if (s.derrubada && tem(DERRUBADA.clip)) novo = "derrubada";
  else if (s.rolando || (X.estado === "rolar" && X.t < H.rolarDur)) novo = "rolar";
  else if (s.aparoPerfeito != null && s.aparoPerfeito >= 0 && s.aparoPerfeito < 0.65 && tem("espada_1"))
    novo = "aparo_perfeito";
  else if (s.aparo != null && s.aparo < 0.45 && tem("espada_2")) novo = "aparo";
  else if (s.golpe != null && tem(LANCA.clip)) novo = "lanca";
  else if (s.machadoCarga != null && tem("machado_golpe")) novo = "machado_carga";
  else if (s.machadoGolpe != null && tem("machado_golpe")) novo = "machado_golpe";
  else if (s.combo && tem(COMBO.passos[Math.min(2, s.combo.passo)].clip)) novo = "combo" + Math.min(2, s.combo.passo);
  else if (s.guarda && s.bloqueou != null && s.bloqueou < REACAO.bloqueio && tem("escudo_bloqueio"))
    novo = "escudo_bloqueio";
  else if (s.atingido != null && s.atingido < REACAO.atingido && tem("atingido")) novo = "atingido";
  else if (s.miraLanca != null && !movendo && tem(LANCA_MIRA)) novo = LANCA_MIRA;
  else if ((s.mirando || (s.carga ?? 0) > 0) && tem("arco_mirar"))
    novo = movendo ? dirArco() : (s.carga ?? 0) < 1 ? "arco_puxar" : "arco_mirar";
  else if ((s.soltando || (X.estado === "arco_soltar" && X.t < SOLTAR.dur)) && tem("arco_soltar")) novo = "arco_soltar";
  else if (s.guarda && tem("escudo_lado")) novo = "escudo";
  else if (recuando) novo = "recuar";
  else if (movendo) novo = s.debilitado ? "andar_debilitado" : (s.correndo ?? 0) > 0.5 ? "correr" : "andar";
  else if (s.modo === "arco" && tem("arco_parada")) novo = "arco_parada";
  else if (s.modo === "faca" && tem("faca_parada")) novo = "faca_parada";
  else if (s.modo === "combate" && tem("escudo_parado")) novo = "combate";
  if (novo !== X.estado) {
    X.ant!.r.set(X.pose!.r);
    X.ant!.q.set(X.pose!.q);
    X.estado = novo;
    X.t = 0;
    X.troca = 0;
  }
  X.t += s.dt;
  X.troca += s.dt;
  /* v7.7 — andando para trás (de frente para o alvo e se afastando): o ciclo do passo corre ao contrário, sem moonwalk */
  const re = movendo && !novo.startsWith("arco_") && Math.cos(s.dirMov ?? 0) < -0.35 ? -1 : 1;
  X.faseAndar += (re * s.andou) / H.passoAndar;
  X.faseCorrer += (re * s.andou) / H.passoCorrer;
  X.faseRecuar = (X.faseRecuar ?? 0) + s.andou / RECUAR.passo;
  const base = X.base!;
  if (s.fixo) poseClip(A, s.fixo.clip, s.fixo.t, false, base);
  else if (novo === "morrer") poseClip(A, "morrer", X.t, false, base);
  else if (novo === "derrubada") {
    const D = DERRUBADA,
      g = s.derrubada!.t,
      tc =
        g < D.tQueda
          ? (g / D.tQueda) * D.queda
          : D.queda +
            Math.min(1, (g - D.tQueda) / Math.max(0.1, s.derrubada!.dur - D.tQueda)) *
              (duracaoClip(A, D.clip) - D.queda);
    poseClip(A, D.clip, tc, false, base);
  } else if (novo === "recuar") {
    // pernas e quadril do passo de guarda; do tronco para cima, a guarda parada da arma
    poseClip(A, RECUAR.clip, X.faseRecuar * duracaoClip(A, RECUAR.clip), true, base);
    const cima = poseClip(
      A,
      s.modo === "faca" && tem("faca_parada") ? "faca_parada" : "escudo_parado",
      X.t,
      true,
      X.aux!,
    );
    for (const nome of RECUAR.cima) {
      const j = A.juntas.indexOf(nome);
      if (j >= 0) base.r.set(cima.r.subarray(j * 4, j * 4 + 4), j * 4);
    }
  } else if (novo === LANCA_MIRA)
    poseClip(A, LANCA_MIRA, X.t, false, base); // a guarda baixa (fica no último quadro)
  else if (novo === "rolar") poseClip(A, "rolar", (X.t / H.rolarDur) * duracaoClip(A, "rolar"), false, base);
  else if (novo === "correr") poseClip(A, "correr", X.faseCorrer * duracaoClip(A, "correr"), true, base);
  else if (novo === "andar" || novo === "andar_debilitado")
    poseClip(A, "andar", X.faseAndar * duracaoClip(A, "andar"), true, base);
  else if (novo === "lanca") {
    const g = s.golpe ?? 0,
      L = LANCA,
      tc =
        g < L.tPico
          ? L.ini + (g / L.tPico) * (L.pico - L.ini)
          : L.pico + Math.min(1, (g - L.tPico) / (L.tFim - L.tPico)) * (L.fim - L.pico);
    poseClip(A, L.clip, tc, false, base);
  } else if (novo === "machado_carga") {
    poseClip(
      A,
      "machado_golpe",
      duracaoClip(A, "machado_golpe") * 0.42 * Math.max(0, Math.min(1, s.machadoCarga ?? 0)),
      false,
      base,
    );
  } else if (novo === "machado_golpe") {
    const p = Math.max(0, Math.min(1, s.machadoGolpe ?? 0));
    poseClip(A, "machado_golpe", duracaoClip(A, "machado_golpe") * (0.42 + 0.58 * p), false, base);
  } else if (novo.startsWith("combo")) {
    const i = Number(novo.slice(5));
    poseClip(A, COMBO.passos[i].clip, tempoCombo(i, s.combo!.t), false, base);
  } else if (novo === "arco_puxar") poseClip(A, novo, (s.carga ?? 0) * duracaoClip(A, novo), false, base);
  else if (novo === "arco_mirar") poseClip(A, novo, X.t, true, base);
  else if (novo === "arco_soltar") poseClip(A, novo, X.t * SOLTAR.vel, false, base);
  else if (novo.startsWith("arco_") && novo !== "arco_parada")
    poseClip(A, novo, X.faseAndar * duracaoClip(A, novo), true, base); // andando mirando
  else if (novo === "aparo") {
    poseClip(A, "espada_2", tempoCombo(2, ((s.aparo ?? 0) * COMBO.tFim) / 0.45), false, base);
  } else if (novo === "aparo_perfeito") {
    poseClip(A, "espada_1", tempoCombo(1, ((s.aparoPerfeito ?? 0) * COMBO.tFim) / 0.65), false, base);
  } else if (novo === "atingido" || novo === "escudo_bloqueio") {
    const dur = novo === "atingido" ? REACAO.atingido : REACAO.bloqueio,
      g = (novo === "atingido" ? s.atingido : s.bloqueou) ?? 0;
    poseClip(A, novo, Math.min(1, g / dur) * duracaoClip(A, novo), false, base);
  } else if (novo === "escudo") {
    // v7.7: parado com o escudo erguido = "block idle"; andando = strafe
    if (!movendo && tem("escudo_parado")) poseClip(A, "escudo_parado", X.t, true, base);
    else poseClip(A, "escudo_lado", movendo ? X.faseAndar * duracaoClip(A, "escudo_lado") : 0, true, base);
  } else if (novo === "combate") poseClip(A, "escudo_parado", X.t, true, base);
  else poseClip(A, novo, X.t, true, base); // parada, arco_parada, faca_parada: em laço
  if (H.paradaRelaxada && (novo === "parada" || s.fixo?.clip === "parada")) relaxarParada(A, base, X.pele ?? A);
  let pesoColeta = 0;
  if (X.coleta > 0) {
    X.coleta -= s.dt;
    X.coletaT += s.dt;
    if (novo === "parada" || novo === "andar" || novo === "correr" || novo.endsWith("_parada")) {
      const d = H.coletarDur,
        e = X.coletaT;
      let w = Math.min(1, e / 0.18, Math.max(0, d - e) / 0.25);
      // v7.7: voltou a andar/correr = levanta em ~0,1 s (antes as pernas ficavam agachadas e o corpo deslizava)
      if (movendo) w = Math.min(w, Math.max(0, (X.coletaPeso ?? w) - s.dt * 9));
      X.coletaPeso = w;
      if (w <= 0) X.coleta = 0;
      else {
        pesoColeta = w * w * (3 - 2 * w);
        misturarPoses(base, poseClip(A, "coletar", 0.4 + e * 0.6, true, X.aux!), pesoColeta, base);
      }
    }
  } else X.coletaPeso = undefined;
  const f = Math.min(1, X.troca / H.troca);
  misturarPoses(X.ant!, base, f * f * (3 - 2 * f), X.pose!);
  // O clip de coleta inclina o tronco de lado e deixa o ombro direito alto. Reduzimos essa inclinação
  // e compensamos no pescoço para a cabeça continuar alinhada, sem mexer no idle nem nas outras animações.
  if (pesoColeta > 0) {
    const ang = 0.3 * pesoColeta,
      tronco = A.juntas.indexOf("Spine2"),
      pescoco = A.juntas.indexOf("Neck");
    if (tronco >= 0) girarJunta(A, X.pose!, matrizesPose(A, X.pose!), tronco, [1, 0, 0], ang);
    if (pescoco >= 0) girarJunta(A, X.pose!, matrizesPose(A, X.pose!), pescoco, [1, 0, 0], -ang);
  }
  // v8.0: mira do arremesso da lança por cima (entra e sai suave)
  const mira = s.miraLanca != null && !s.morto && novo !== "rolar" && novo !== "derrubada";
  X.miraPeso = Math.max(0, Math.min(1, (X.miraPeso ?? 0) + (mira ? s.dt / MIRA_LANCA.entra : -s.dt / MIRA_LANCA.sai)));
  if (mira) X.miraCh = s.miraLanca!;
  X.miraT = mira ? (X.miraT ?? 0) + s.dt : 0;
  if (X.miraPeso > 0) {
    const w = X.miraPeso;
    X.mat = X.mat ?? matrizesPose(A, X.pose!);
    miraLanca(A, X.pose!, X.mat, w * w * (3 - 2 * w), X.miraCh ?? 0, X.miraT, s.movendo ?? 0);
  }
  // A puxada do arco termina com a mão direita ancorada junto à bochecha; a pose do clip
  // ainda conduz o início do saque e a correção entra gradualmente conforme a carga cresce.
  if ((novo === "arco_puxar" || novo === "arco_mirar") && !movendo) {
    const c = Math.max(0, Math.min(1, s.carga ?? 1)),
      p = Math.max(0, Math.min(1, (c - 0.25) / 0.75)),
      w = 0.78 * p * p * (3 - 2 * p);
    if (w > 0) {
      X.mat = X.mat ?? matrizesPose(A, X.pose!);
      miraArco(A, X.pose!, X.mat, w);
    }
  }
  if (novo.startsWith("arco_") && novo !== "arco_parada" && novo !== "arco_soltar") {
    const carga = Math.max(0, Math.min(1, s.carga ?? 1)),
      p = Math.max(0, (carga - 0.25) / 0.75);
    alinharArco(X, p * p * (3 - 2 * p));
  }
  return desenharPoseAnimada(X);
}

/** Ajusta a pegada à arma já posicionada, girando os ossos sem alongá-los.
 * Os alvos são calculados no corpo vestido; na lança a mão pode deslizar pelo cabo
 * quando a pegada desejada ultrapassa o alcance natural do braço. */
export function prenderMaosNaArma(X: Animado, arma: Mat4, duasMaos: boolean) {
  if (!X.A || !X.pose) return null;
  const A = X.pele ?? X.A,
    pose = X.pele ? { r: X.pose.r, q: X.poseP!.q } : X.pose,
    m = matrizesPose(A, pose),
    comp = Math.hypot(arma[0], arma[1], arma[2]) || 1,
    eixo = [arma[0] / comp, arma[1] / comp, arma[2] / comp];
  for (const lado of duasMaos ? ["Right", "Left"] : ["Right"]) {
    const jA = A.juntas.indexOf(lado + "Arm"),
      jF = A.juntas.indexOf(lado + "ForeArm"),
      jH = A.juntas.indexOf(lado + "Hand"),
      palma = X.K[lado === "Right" ? "palmaD" : "palmaE"];
    if (jA < 0 || jF < 0 || jH < 0 || !palma) continue;
    const ombro = _pos(m, jA),
      alcance = (_len(_sub(_pos(m, jF), ombro)) + _len(_sub(_pos(m, jH), _pos(m, jF)))) * 0.96,
      sinal = ombro[2] >= 0 ? 1 : -1;
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const H = M4.mul(juntaGlobal(A, m, lado + "Hand")!, palma.m),
        punho = _pos(m, jH),
        inicio = [arma[12], arma[13], arma[14]].map((v, i) => v - ([H[12], H[13], H[14]][i] - punho[i])),
        aoOmbro = _sub(ombro, inicio),
        centro = _dot(aoOmbro, eixo),
        lateral2 = Math.max(0, _dot(aoOmbro, aoOmbro) - centro * centro),
        meia = Math.sqrt(Math.max(0, alcance * alcance - lateral2)),
        pegada = lado === "Right" ? 0 : 10 * comp,
        t = Math.max(centro - meia, Math.min(centro + meia, pegada)),
        alvo = inicio.map((v, i) => v + eixo[i] * t);
      bracoIK(A, pose, m, lado, alvo, [-0.4, -0.5, sinal], 1);
      if (lado === "Right" && tentativa === 0 && X.K.arma) {
        const W = M4.mul(juntaGlobal(A, m, lado + "Hand")!, X.K.arma.m);
        girarPara(A, pose, m, jH, [W[0], W[1], W[2]], eixo, 1);
        matrizesPose(A, pose, m);
      }
    }
  }
  return desenharPoseAnimada(X);
}

/** Deforma e envia uma pose já resolvida, compartilhada pelo corpo e pelas roupas. */
function desenharPoseAnimada(X: Animado): { mesh: GLMesh; mat: MatrizesPose } | null {
  const A = X.A;
  if (!A || !GL3.gl) return null;
  let mat = (X.mat = matrizesPose(A, X.pose!, X.mat ?? undefined));
  // v8.0: vestido com outra malha: a mesma pose nas juntas dela (a altura do quadril na proporção do repouso dela)
  const P = X.pele ?? A;
  if (X.pele) {
    const pp = (X.poseP = X.poseP ?? novaPose(P));
    pp.r.set(X.pose!.r);
    const k = P.repouso[1] / (A.repouso[1] || 1);
    for (let i = 0; i < 3; i++) pp.q[i] = X.pose!.q[i] * k;
    mat = X.matP = matrizesPose(P, pp, X.matP ?? undefined);
  }
  if (!X.V) X.V = new Float32Array(P.P.length);
  const def = (X.def = deformarMalha(P, mat, X.def ?? undefined, X.V));
  if (!X.NS) {
    X.NS = new Float32Array(def.n.length);
    X.HS = new Float32Array(def.n.length);
  }
  normaisSuaves(P, def.n, SMOOTH_COS, X.NS, X.HS!);
  const mesh = X.mesh && X.gl === GL3.gl ? X.mesh : criarMalhaGL(X, def, P);
  const gl = GL3.gl;
  for (const [loc, arr] of [
    [0, def.p],
    [1, X.NS],
    [3, X.HS!],
  ] as const) {
    gl.bindBuffer(gl.ARRAY_BUFFER, X.bufs[loc]);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, arr);
  }
  return { mesh, mat };
}

/** Deforma outra malha com o mesmo estado e instante de animação de uma referência.
 *  As roupas usam o mesmo esqueleto, mas não podem avançar seus relógios separadamente:
 *  isso fazia ombros, cabeça e pernas divergirem do corpo ao andar ou coletar. */
export function animarNoInstanteDe(X: Animado, referencia: Animado, _s: SituacaoAnim) {
  if (!referencia.pose || !referencia.ant || !referencia.base || !referencia.aux) return null;
  if (!X.tentou && !carregar(X)) return null;
  const copiarPose = (destino: Pose, origem: Pose) => {
    destino.r.set(origem.r);
    destino.q.set(origem.q);
  };
  X.estado = referencia.estado;
  X.t = referencia.t;
  X.faseAndar = referencia.faseAndar;
  X.faseCorrer = referencia.faseCorrer;
  X.faseRecuar = referencia.faseRecuar;
  X.troca = referencia.troca;
  X.coleta = referencia.coleta;
  X.coletaT = referencia.coletaT;
  X.coletaPeso = referencia.coletaPeso;
  X.miraPeso = referencia.miraPeso;
  X.miraCh = referencia.miraCh;
  X.miraT = referencia.miraT;
  copiarPose(X.ant!, referencia.ant);
  copiarPose(X.pose!, referencia.pose);
  copiarPose(X.base!, referencia.base);
  copiarPose(X.aux!, referencia.aux);
  if (X.aux2 && referencia.aux2) copiarPose(X.aux2, referencia.aux2);
  return desenharPoseAnimada(X);
}

/** v7.7 — matriz (espaço do modelo) de uma peça presa no instante g (s) do passo do combo, só o clip (sem a mistura
    da troca): o rastro da espada amostra os últimos instantes sem depender do FPS. null sem o clip. */
export function presoNoCombo(X: Animado, passo: number, g: number, nome: string) {
  const A = X.A,
    i = Math.min(2, passo),
    P = COMBO.passos[i];
  if (!A || !A.clips[P.clip]) return null;
  X.aux2 = poseClip(A, P.clip, tempoCombo(i, g), false, X.aux2 ?? undefined);
  X.mat2 = matrizesPose(A, X.aux2, X.mat2 ?? undefined);
  return preso(X, X.mat2, nome);
}

/** v8.0 — a cor média (rgb 0..1) dos triângulos presos sobretudo à junta `nome` (a mão: o punho em volta da lança);
    null antes de carregar. */
export function corDaJunta(X: Animado, nome: string) {
  const A = X.A,
    j = A ? A.juntas.indexOf(nome) : -1;
  if (!A || j < 0) return null;
  const s = [0, 0, 0];
  let n = 0;
  for (let t = 0; t < A.I.length / 3; t++) {
    const v = A.I[t * 3];
    let mx = 0,
      jm = -1;
    for (let k = 0; k < 4; k++)
      if (A.W[v * 4 + k] > mx) {
        mx = A.W[v * 4 + k];
        jm = A.J[v * 4 + k];
      }
    if (jm !== j) continue;
    for (let k = 0; k < 3; k++) s[k] += A.C[t * 3 + k];
    n++;
  }
  return n ? s.map((v) => v / n) : null;
}

/* v8.0 — peça presa encostada na malha de quem veste o animado (mantenedor 2026-10-25: o arco "flutua perto do
   corpo"): os lugares das peças foram ajustados num corpo só (a heroína de peças); noutro mais magro ou mais largo
   elas ficavam soltas ou entravam nele. A peça se move ao longo de `n` (no espaço dela, depois de `preso`) até o
   ponto da face de dentro que primeiro encosta ficar a `folga` da superfície. A medida é na malha de bind do corpo
   atual (a peça vai para lá por inversa(ibm) × K.m, o que não depende da pose), uma vez por corpo e peça. */
const ENCOSTO = { raio: 1.3, atras: 4, frente: 15 };
const ENCOSTADOS = new WeakMap<Anim, Map<string, number>>();
/** Quanto a peça `chave` (presa em `nome`) anda ao longo de `n` para encostar; `amostras` = pontos da face de dentro. */
export function encosto(X: Animado, nome: string, chave: string, amostras: number[][], n: number[], folga: number) {
  const A = X.pele ?? X.A,
    k = X.K[nome];
  if (!A || !k) return 0;
  let porCorpo = ENCOSTADOS.get(A);
  if (!porCorpo) ENCOSTADOS.set(A, (porCorpo = new Map()));
  const salvo = porCorpo.get(chave);
  if (salvo !== undefined) return salvo;
  const j = A.juntas.indexOf(k.j);
  let d = 0;
  if (j >= 0) {
    const Mb = M4.mul(inversa(A.ibm.subarray(j * 16, j * 16 + 16)), k.m),
      nb = [0, 1, 2].map((e) => Mb[e] * n[0] + Mb[4 + e] * n[1] + Mb[8 + e] * n[2]),
      ln = Math.hypot(nb[0], nb[1], nb[2]) || 1;
    for (let e = 0; e < 3; e++) nb[e] /= ln;
    let menor = Infinity;
    for (const a of amostras) {
      const s = M4.ap(Mb, a[0], a[1], a[2]);
      for (let v = 0; v < A.P.length / 3; v++) {
        const w0 = A.P[v * 3] - s[0],
          w1 = A.P[v * 3 + 1] - s[1],
          w2 = A.P[v * 3 + 2] - s[2],
          ao = w0 * nb[0] + w1 * nb[1] + w2 * nb[2];
        if (ao < -ENCOSTO.atras || ao > ENCOSTO.frente || ao >= menor) continue;
        if (Math.hypot(w0 - ao * nb[0], w1 - ao * nb[1], w2 - ao * nb[2]) < ENCOSTO.raio) menor = ao;
      }
    }
    // (a escala da junta é a do corpo: a distância medida no bind volta para o espaço da peça dividida por ela)
    if (menor < Infinity) d = (menor - folga) / ln;
  }
  porCorpo.set(chave, d);
  return d;
}
/** Matriz (espaço do modelo) de uma peça presa, na pose atual. */
export function preso(X: Animado, mat: MatrizesPose, nome: string) {
  const k = X.K[nome];
  return M4.mul(juntaGlobal(X.A!, mat, k.j)!, k.m);
}
