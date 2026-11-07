/* ==== v7.7 — cenário do campo em low poly (src/assets/models/cenario.json, gerado por tools/gerar-chao.ts com o plano tools/modelos/cenario.json) ====
   Árvores (folhosa, pinheiro, outono), moitas e pedras da folha de natureza do Tripo no lugar das feitas por código.
   Cada grupo tem variantes ("<grupo>_<n>" no plano); a variante, o giro e um leve tom saem da posição, então a cena
   não gasta grnd() a mais. Sem os dados (testes em Node) mbCenario devolve false e quem chama usa a malha antiga. */
import { bytes } from "./chao.ts";
import { corEstacao, estacaoVista } from "./estacao_cor.ts";
import type { MalhaCrua } from "../../core/tipos.ts";

interface DadosCenario {
  versao: number;
  pecas: Record<string, { p: string; c: string }>;
  itens: Record<string, { peca: string; tam: number; tom?: number[] }>;
}
// o marcador precisa de `{}` logo depois do comentário (o plugin troca os dois pelo JSON); nos testes em Node fica vazio
const DADOS = /* @inline-json src/assets/models/cenario.json */ {} as DadosCenario;

/** luz: multiplica a cor da folha (a textura do Tripo é mais escura que a paleta do jogo); brilho: variação (±)
 *  entre exemplares da mesma variante. */
const CENARIO = { luz: 1.3, brilho: 0.08 };

/** Enfeites das bordas do campo (mbEnfeitesBorda), em ladrilhos (T): a cada `passo` (± metade) sai um pequeno com
 *  chance `pequeno` e um grande com chance `grande`; pesos de cada grupo; faixas de distância para fora da borda. */
const ENFEITES = {
  passo: 1.1,
  pequeno: 0.75,
  grande: 0.4,
  pequenos: { samambaia: 4, cogumelo: 1 } as Record<string, number>,
  grandes: { tronco: 3, seca: 2, tocos: 1 } as Record<string, number>,
  faixaPequeno: [0.1, 0.9],
  faixaGrande: [0.6, 2.6],
};

/** v7.7 — enfeites no meio do campo (mbEnfeitesMeio): quantos de cada grupo por 100 ladrilhos de área, a escala
 *  (mín, máx) e a distância mínima entre eles e do que não pode ser coberto (em ladrilhos). Sem cogumelos (parecem
 *  item); troncos e pedras baixos, para não esconder bicho nem item. */
const ENFEITES_MEIO = {
  densidade: <Record<string, number>>{ samambaia: 9, moita: 3.5, pedra: 4, tronco: 1.6 },
  escala: <Record<string, [number, number]>>{
    samambaia: [0.6, 0.95],
    moita: [0.45, 0.7],
    pedra: [0.45, 0.8],
    tronco: [0.7, 0.95],
  },
  entre: 0.7,
};

const CACHE = {
  pecas: {} as Record<string, { P: Int16Array; C: Uint8Array }>,
  grupos: null as Record<string, string[]> | null,
};

function grupos() {
  if (!CACHE.grupos) {
    const g: Record<string, string[]> = {};
    for (const k of Object.keys(DADOS.itens || {})) (g[k.replace(/_\d+$/, "")] ||= []).push(k);
    CACHE.grupos = g;
  }
  return CACHE.grupos;
}
function peca(id: string) {
  if (!CACHE.pecas[id]) {
    const pc = DADOS.pecas[id];
    CACHE.pecas[id] = { P: new Int16Array(bytes(pc.p).buffer), C: bytes(pc.c) };
  }
  return CACHE.pecas[id];
}
/** Número em [0, 1) fixo para cada posição (e canal k). */
function hash(x: number, z: number, k: number) {
  const s = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

/** Põe em b um exemplar do grupo ("folhosa", "pinheiro", "outono", "moita", "moita_outono", "pedra", "laje", "poco"…)
 *  com a base em (x, 0, z) e o tamanho do plano × sc. Devolve false se o grupo não tem modelo.
 *  opc.altura: achata a peça até essa altura (a laje da runa, com o símbolo por cima); opc.semente: escolhe a
 *  variante e o giro por ela, não pela posição (peça montada na origem e posta no lugar depois); opc.giro: giro fixo
 *  em radianos (a bigorna do acampamento). */
export function mbCenario(
  b: MalhaCrua,
  grupo: string,
  x: number,
  z: number,
  sc: number,
  opc: { altura?: number; semente?: number; giro?: number } = {},
) {
  const vs = grupos()[grupo];
  if (!vs || !vs.length) return false;
  const hx = opc.semente ?? x,
    hz = opc.semente != null ? 0 : z;
  emitir(
    b,
    DADOS.itens[vs[Math.floor(hash(hx, hz, 1) * vs.length)]],
    x,
    z,
    sc,
    opc.giro ?? hash(hx, hz, 2) * Math.PI * 2,
    CENARIO.luz * (1 + (hash(hx, hz, 3) - 0.5) * 2 * CENARIO.brilho),
    opc.altura,
  );
  return true;
}

/** v8.1 — os itens do cenário ("folhosa_1", "barraca_1"…), para a biblioteca do Modo Editor. */
export function itensCenario() {
  return Object.keys(DADOS.itens || {});
}
/** v8.1 — põe em b o item `item` exato (sem sorteio de variante), na origem, sem giro, na luz padrão (Modo Editor);
 *  `est`: pintado na estação (render/gl/estacao_cor.ts; sem ela, a da prévia do editor). */
export function mbCenarioItem(b: MalhaCrua, item: string, est = estacaoVista(), x = 0, z = 0, sc = 1, giro = 0) {
  const it = DADOS.itens?.[item];
  if (!it) return false;
  emitir(b, it, x, z, sc, giro, CENARIO.luz, undefined, est);
  return true;
}

function emitir(
  b: MalhaCrua,
  it: { peca: string; tam: number; tom?: number[] },
  x: number,
  z: number,
  sc: number,
  a: number,
  luz: number,
  altura?: number,
  est = estacaoVista(),
) {
  const { P, C } = peca(it.peca),
    k = (it.tam * sc) / 20000,
    ca = Math.cos(a),
    sa = Math.sin(a),
    tom = it.tom;
  let ky = k;
  if (altura != null) {
    let ymax = 0;
    for (let i = 1; i < P.length; i += 3) ymax = Math.max(ymax, P[i]);
    ky = ymax > 0 ? altura / ymax : k;
  }
  for (let t = 0; t < P.length / 9; t++) {
    const v = [0, 1, 2].map((j) => {
      const px = P[t * 9 + j * 3] * k,
        py = P[t * 9 + j * 3 + 1] * ky,
        pz = P[t * 9 + j * 3 + 2] * k;
      return [x + px * ca - pz * sa, py, z + px * sa + pz * ca];
    });
    const u = [v[1][0] - v[0][0], v[1][1] - v[0][1], v[1][2] - v[0][2]],
      w = [v[2][0] - v[0][0], v[2][1] - v[0][1], v[2][2] - v[0][2]];
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    n = n.map((q) => q / l);
    let cor = [0, 1, 2].map((e) => {
      const c = C[t * 3 + e] / 255;
      return Math.min(1, (tom ? c * (1 - tom[3]) + tom[e] * tom[3] : c) * luz);
    });
    if (est) cor = corEstacao(cor, "planta", n[1], t * 7 + Math.round(x * 3.1 + z * 5.3), est); // v8.1: a estação
    for (const q of v) {
      b.p.push(q[0], q[1], q[2]);
      b.n.push(n[0], n[1], n[2]);
      b.c.push(cor[0], cor[1], cor[2]);
    }
  }
}

/** Troncos caídos, tocos, árvores secas, samambaias e cogumelos nas bordas do campo (esquerda, direita e fundo; na
 *  frente só samambaias, que são baixas), fora da área de jogo, para não parecerem obstáculos nem itens. Usa um
 *  sorteio próprio, então não muda a posição do resto da cena. `livre(x, z)` = true onde não pode ter nada. */
export function mbEnfeitesBorda(
  b: MalhaCrua,
  W: number,
  H: number,
  T: number,
  semente: number,
  livre: (x: number, z: number) => boolean,
) {
  if (!grupos().samambaia) return;
  let s = semente >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296,
    escolhe = (pesos: Record<string, number>) => {
      const ks = Object.keys(pesos);
      let r = rnd() * ks.reduce((a, k) => a + pesos[k], 0);
      for (const k of ks) if ((r -= pesos[k]) < 0) return k;
      return ks[0];
    },
    entre = (f: number[]) => (f[0] + rnd() * (f[1] - f[0])) * T,
    E = ENFEITES;
  // cada borda: comprimento e como um ponto (ao longo, distância para fora) vira (x, z)
  const bordas: [number, (a: number, d: number) => [number, number], boolean][] = [
    [H, (a, d) => [T - d, a], true],
    [H, (a, d) => [W - T + d, a], true],
    [W, (a, d) => [a, T * 0.4 - d], true],
    [W, (a, d) => [a, H - T * 0.2 + d * 0.5], false],
  ];
  for (const [comp, ponto, grandes] of bordas)
    for (let a = -T; a < comp + T; a += T * E.passo * (0.5 + rnd())) {
      const sorteios: [number, Record<string, number>, number[]][] = [
        [E.pequeno, grandes ? E.pequenos : { samambaia: 1 }, E.faixaPequeno],
        [grandes ? E.grande : 0, E.grandes, E.faixaGrande],
      ];
      for (const [chance, pesos, faixa] of sorteios) {
        if (rnd() >= chance) continue;
        const grupo = escolhe(pesos),
          [x, z] = ponto(a + (rnd() - 0.5) * T * 0.6, entre(faixa)),
          sc = 0.8 + rnd() * 0.4;
        if (!livre(x, z)) mbCenario(b, grupo, x, z, sc);
      }
    }
}

/** v7.7 — samambaias, moitas baixas, pedras e troncos caídos espalhados no meio do campo (o campo estava pelado).
 *  Sorteio próprio; `livre(x, z)` = true onde não pode ter nada (entrada, runas, moitas de esconder). */
export function mbEnfeitesMeio(
  b: MalhaCrua,
  W: number,
  H: number,
  T: number,
  semente: number,
  livre: (x: number, z: number) => boolean,
) {
  if (!grupos().samambaia) return;
  let s = (semente ^ 0x5bd1e995) >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296,
    E = ENFEITES_MEIO,
    area = ((W - 2 * T) * (H - 2 * T)) / (T * T),
    postos: [number, number][] = [];
  for (const [grupo, dens] of Object.entries(E.densidade)) {
    const n = Math.round((dens * area) / 100),
      [e0, e1] = E.escala[grupo];
    for (let k = 0, tent = 0; k < n && tent < n * 12; tent++) {
      const x = T * 1.3 + rnd() * (W - T * 2.6),
        z = T * 1.3 + rnd() * (H - T * 2.6);
      if (livre(x, z) || postos.some(([px, pz]) => Math.hypot(px - x, pz - z) < T * E.entre)) continue;
      if (mbCenario(b, grupo, x, z, e0 + rnd() * (e1 - e0))) {
        postos.push([x, z]);
        k++;
      }
    }
  }
}
