/* ==== v8.1 (2026-11-07) — o pescoço das cabeças trocadas (render/gl/aparencias.ts comporPele e peleDaAparencia).
   Mantenedor: "alguns pescoços ainda apresentam defeitos e se aparece aquele vão coloque algum volume de objeto pra
   disfarçar esse aspecto de cabeça colada flutuando faltando pedaço e centraliza a cabeça no pescoço e ombros".
   - bordaDaMalha / bordaComNormais: os vértices das aberturas da malha (arestas de um triângulo só, soldando por
     posição: as costuras de UV do Tripo repetem o vértice no mesmo lugar);
   - ajusteFrenteTras: quanto a cabeça anda na frente/trás para o pescoço dela cair dentro da abertura do corpo;
   - acabarPescoco: (1) fecha com pele os buracos que o recorte do cabelo original deixou longe do pescoço (a tira no
     peito da F05, o ombro da Líder), costurando as bordas; (2) recolhe para dentro do peito o fim do pescoço da cabeça
     que atravessava a pele do corpo (um "V" de outra cor de pele no colo); (3) se a abertura do pescoço do corpo ainda
     fica para fora da pele do pescoço da cabeça (o vão escuro, a nuca aberta da F03, as tiras soltas do recorte, os
     furos embaixo da mandíbula das cabeças de busto), põe a gola: um pano em volta do pescoço, medido por raios
     horizontais a partir do eixo do pescoço contra a primeira camada de pele do corpo e da cabeça, que passa por fora de
     todo ponto descoberto. Os pesos do pano vêm do corpo embaixo e do pescoço da cabeça em cima (estica quando a cabeça
     vira).
   Tudo puro (pose de bind, espaço do jogo); as medidas ficam em data/aparencias.ts (ENCAIXE_CABECA, GOLA). ==== */
import type { Anim } from "./esqueleto.ts";
import { ENCAIXE_CABECA, GOLA } from "../../data/aparencias.ts";

/** A posição de uma junta na pose de bind (a translação da inversa da matriz de bind, que é rígida). */
export function juntaNoBind(A: Pick<Anim, "juntas" | "ibm">, nome: string): number[] | null {
  const j = A.juntas.indexOf(nome);
  if (j < 0) return null;
  const m = A.ibm,
    o = j * 16,
    s2 = m[o] * m[o] + m[o + 1] * m[o + 1] + m[o + 2] * m[o + 2] || 1;
  return [0, 1, 2].map(
    (i) => -(m[o + i * 4] * m[o + 12] + m[o + i * 4 + 1] * m[o + 13] + m[o + i * 4 + 2] * m[o + 14]) / s2,
  );
}

/** Solda os vértices dos triângulos `tris` pela posição (1/200 de unidade): cada vértice aponta para o primeiro na mesma
 *  posição (os outros ficam apontando para si mesmos). A chave é um número (48 bits): com texto, era o mais lento. */
function soldar(P: ArrayLike<number>, I: ArrayLike<number>, tris: number | ArrayLike<number>) {
  const nv = P.length / 3,
    rep = new Int32Array(nv).fill(-1),
    id = new Map<number, number>(),
    lista = typeof tris === "number" ? null : tris,
    nt = typeof tris === "number" ? tris : tris.length;
  for (let n = 0; n < nt; n++) {
    const t = lista ? lista[n] : n;
    for (let k = 0; k < 3; k++) {
      const v = I[t * 3 + k];
      if (rep[v] >= 0) continue;
      const chave =
        ((Math.round(P[v * 3] * 200) + 32768) * 65536 + (Math.round(P[v * 3 + 1] * 200) + 32768)) * 65536 +
        (Math.round(P[v * 3 + 2] * 200) + 32768);
      let r = id.get(chave);
      if (r === undefined) id.set(chave, (r = v));
      rep[v] = r;
    }
  }
  for (let v = 0; v < nv; v++) if (rep[v] < 0) rep[v] = v;
  return rep;
}

/** Os triângulos numa grade de cubos de lado `lado` (pela caixa de cada um), para achar os perto de um ponto. */
function grade(P: ArrayLike<number>, I: ArrayLike<number>, tris: ArrayLike<number>, lado: number) {
  const celulas = new Map<number, number[]>(),
    chave = (x: number, y: number, z: number) => ((x + 1024) * 2048 + (y + 1024)) * 2048 + (z + 1024);
  for (let n = 0; n < tris.length; n++) {
    const t = tris[n],
      mn = [Infinity, Infinity, Infinity],
      mx = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < 3; k++)
      for (let e = 0; e < 3; e++) {
        const c = P[I[t * 3 + k] * 3 + e];
        mn[e] = Math.min(mn[e], c);
        mx[e] = Math.max(mx[e], c);
      }
    for (let x = Math.floor(mn[0] / lado); x <= Math.floor(mx[0] / lado); x++)
      for (let y = Math.floor(mn[1] / lado); y <= Math.floor(mx[1] / lado); y++)
        for (let z = Math.floor(mn[2] / lado); z <= Math.floor(mx[2] / lado); z++) {
          const k = chave(x, y, z);
          (celulas.get(k) ?? celulas.set(k, []).get(k)!).push(t);
        }
  }
  /** os triângulos que podem estar a menos de `raio` do ponto */
  return (p: number[], raio: number) => {
    const vistos = new Set<number>();
    for (let x = Math.floor((p[0] - raio) / lado); x <= Math.floor((p[0] + raio) / lado); x++)
      for (let y = Math.floor((p[1] - raio) / lado); y <= Math.floor((p[1] + raio) / lado); y++)
        for (let z = Math.floor((p[2] - raio) / lado); z <= Math.floor((p[2] + raio) / lado); z++)
          for (const t of celulas.get(chave(x, y, z)) ?? []) vistos.add(t);
    return [...vistos];
  };
}

/** As arestas de borda (de um triângulo só) dos triângulos `tris` (um número = os `tris` primeiros), já soldadas, e a
 *  normal (para fora, pela área) da pele em volta de cada vértice da borda. */
function arestasDeBorda(A: Pick<Anim, "P" | "I">, tris: number | ArrayLike<number>) {
  const lista = typeof tris === "number" ? null : tris,
    nt = typeof tris === "number" ? tris : tris.length,
    tri = (n: number) => (lista ? lista[n] : n),
    rep = soldar(A.P, A.I, tris),
    cont = new Map<number, number>(),
    sentido = new Map<number, number>();
  for (let n = 0; n < nt; n++) {
    const t = tri(n);
    for (let k = 0; k < 3; k++) {
      const a = rep[A.I[t * 3 + k]],
        b = rep[A.I[t * 3 + ((k + 1) % 3)]];
      if (a === b) continue;
      const chave = a < b ? a * 65536 + b : b * 65536 + a;
      cont.set(chave, (cont.get(chave) ?? 0) + 1);
      sentido.set(chave, a * 65536 + b);
    }
  }
  const arestas: number[][] = [],
    normal = new Map<number, number[]>(),
    orientadas = new Set<number>();
  for (const [chave, n] of cont)
    if (n === 1) {
      const a = Math.floor(chave / 65536),
        b = chave % 65536;
      arestas.push([a, b]);
      orientadas.add(sentido.get(chave)!);
      normal.set(a, [0, 0, 0]);
      normal.set(b, [0, 0, 0]);
    }
  for (let m = 0; m < nt; m++) {
    const t = tri(m),
      a = A.I[t * 3],
      b = A.I[t * 3 + 1],
      c = A.I[t * 3 + 2],
      soma = [rep[a], rep[b], rep[c]].filter((v) => normal.has(v));
    if (!soma.length) continue;
    const e1 = [0, 1, 2].map((k) => A.P[b * 3 + k] - A.P[a * 3 + k]),
      e2 = [0, 1, 2].map((k) => A.P[c * 3 + k] - A.P[a * 3 + k]),
      n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (const v of soma) {
      const s = normal.get(v)!;
      for (let k = 0; k < 3; k++) s[k] += n[k];
    }
  }
  for (const n of normal.values()) {
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    for (let k = 0; k < 3; k++) n[k] /= l;
  }
  /** se a aresta de borda a→b está no sentido do triângulo dela */
  const noSentido = (a: number, b: number) => orientadas.has(a * 65536 + b);
  return { arestas, normal, soldado: rep, noSentido };
}

/** Os vértices (soldados por posição) da borda dos `nt` primeiros triângulos: as aberturas da malha, xyz seguidos. */
export function bordaDaMalha(A: Pick<Anim, "P" | "I">, nt: number): number[] {
  return bordaComNormais(A, nt).pontos;
}
/** Como bordaDaMalha, com a normal (para fora) da pele em cada ponto e o vértice de cada um. */
function bordaComNormais(A: Pick<Anim, "P" | "I">, tris: number | ArrayLike<number>) {
  const { normal, soldado } = arestasDeBorda(A, tris),
    pontos: number[] = [],
    normais: number[] = [],
    vertices: number[] = [];
  for (const [v, n] of normal) {
    pontos.push(A.P[v * 3], A.P[v * 3 + 1], A.P[v * 3 + 2]);
    normais.push(n[0], n[1], n[2]);
    vertices.push(v);
  }
  return { pontos, normais, vertices, soldado };
}

/** Os laços da borda, em ordem (vértices soldados). Num vértice com mais de duas arestas de borda o laço segue pela
 *  primeira livre (um "8" vira dois laços). */
function lacosDaBorda(arestas: number[][]) {
  const viz = new Map<number, number[]>(),
    usada = new Set<number>(),
    chave = (a: number, b: number) => (a < b ? a * 65536 + b : b * 65536 + a);
  for (const [a, b] of arestas) {
    (viz.get(a) ?? viz.set(a, []).get(a)!).push(b);
    (viz.get(b) ?? viz.set(b, []).get(b)!).push(a);
  }
  const lacos: number[][] = [];
  for (const [inicio, vs] of viz)
    for (const primeiro of vs) {
      if (usada.has(chave(inicio, primeiro))) continue;
      usada.add(chave(inicio, primeiro));
      const laco = [inicio];
      let at = primeiro;
      while (at !== inicio) {
        laco.push(at);
        const prox = viz.get(at)!.find((v) => !usada.has(chave(at, v)));
        if (prox === undefined) break;
        usada.add(chave(at, prox));
        at = prox;
      }
      if (laco.length >= 3) lacos.push(laco);
    }
  return lacos;
}

/** Costura um laço: tira sempre a "orelha" de diagonal mais curta (numa fenda as duas margens se juntam como um zíper).
 *  Os triângulos percorrem cada aresta da borda ao contrário do triângulo vizinho (`noSentido`): o remendo fica virado
 *  para o mesmo lado da pele em volta. */
function costurar(laco: number[], P: ArrayLike<number>, noSentido: (a: number, b: number) => boolean) {
  let votos = 0;
  for (let i = 0; i < laco.length; i++) votos += noSentido(laco[i], laco[(i + 1) % laco.length]) ? 1 : -1;
  const L = votos > 0 ? laco.slice().reverse() : laco.slice(),
    tris: number[][] = [],
    d2 = (a: number, b: number) =>
      (P[a * 3] - P[b * 3]) ** 2 + (P[a * 3 + 1] - P[b * 3 + 1]) ** 2 + (P[a * 3 + 2] - P[b * 3 + 2]) ** 2;
  while (L.length > 3) {
    let melhor = 0,
      menor = Infinity;
    for (let i = 0; i < L.length; i++) {
      const d = d2(L[(i + L.length - 1) % L.length], L[(i + 1) % L.length]);
      if (d < menor) {
        menor = d;
        melhor = i;
      }
    }
    tris.push([L[(melhor + L.length - 1) % L.length], L[melhor], L[(melhor + 1) % L.length]]);
    L.splice(melhor, 1);
  }
  tris.push([L[0], L[1], L[2]]);
  return tris;
}

/** Os segmentos (x1, z1, x2, z2 seguidos) onde o plano horizontal y corta os triângulos `tris`. */
function fatiar(P: ArrayLike<number>, I: ArrayLike<number>, tris: ArrayLike<number>, y: number, out: number[]) {
  out.length = 0;
  for (let n = 0; n < tris.length; n++) {
    const t = tris[n];
    let achados = 0,
      x1 = 0,
      z1 = 0;
    for (let k = 0; k < 3; k++) {
      const a = I[t * 3 + k],
        b = I[t * 3 + ((k + 1) % 3)],
        ya = P[a * 3 + 1] - y,
        yb = P[b * 3 + 1] - y;
      if (ya < 0 === yb < 0) continue;
      const s = ya / (ya - yb),
        x = P[a * 3] + (P[b * 3] - P[a * 3]) * s,
        z = P[a * 3 + 2] + (P[b * 3 + 2] - P[a * 3 + 2]) * s;
      if (!achados) {
        x1 = x;
        z1 = z;
      } else out.push(x1, z1, x, z);
      achados++;
    }
  }
}

/** Até onde vai a primeira camada de pele que o raio horizontal (de (ax, az) na direção (dx, dz)) cruza: a primeira
 *  travessia e as que vêm a menos de `camada` uma da outra (pele, camisa, colete); o ombro mais longe não conta, senão o
 *  pano virava capa. -1 se não cruza nada até `max`. */
function alcanceRaio(seg: number[], ax: number, az: number, dx: number, dz: number, max: number, camada: number) {
  const ts: number[] = [];
  for (let i = 0; i < seg.length; i += 4) {
    const ex = seg[i + 2] - seg[i],
      ez = seg[i + 3] - seg[i + 1],
      den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-12) continue;
    const wx = seg[i] - ax,
      wz = seg[i + 1] - az,
      t = (wx * ez - wz * ex) / den,
      s = (wx * dz - wz * dx) / den;
    if (s < 0 || s > 1 || t <= 0 || t > max) continue;
    ts.push(t);
  }
  if (!ts.length) return -1;
  ts.sort((a, b) => a - b);
  let r = ts[0];
  for (let i = 1; i < ts.length && ts[i] - r <= camada; i++) r = ts[i];
  return r;
}

/** O quadrado da distância do ponto (x, y, z) ao triângulo de vértices a, b, c (o ponto mais perto dele; Ericson). */
function dist2Triangulo(P: ArrayLike<number>, ia: number, ib: number, ic: number, x: number, y: number, z: number) {
  const a = [P[ia * 3], P[ia * 3 + 1], P[ia * 3 + 2]],
    ab = [P[ib * 3] - a[0], P[ib * 3 + 1] - a[1], P[ib * 3 + 2] - a[2]],
    ac = [P[ic * 3] - a[0], P[ic * 3 + 1] - a[1], P[ic * 3 + 2] - a[2]],
    ap = [x - a[0], y - a[1], z - a[2]],
    dot = (m: number[], n: number[]) => m[0] * n[0] + m[1] * n[1] + m[2] * n[2],
    d1 = dot(ab, ap),
    d2 = dot(ac, ap);
  let v = 0,
    w = 0;
  if (d1 <= 0 && d2 <= 0) {
    v = w = 0;
  } else {
    const bp = [ap[0] - ab[0], ap[1] - ab[1], ap[2] - ab[2]],
      d3 = dot(ab, bp),
      d4 = dot(ac, bp);
    if (d3 >= 0 && d4 <= d3) {
      v = 1;
      w = 0;
    } else {
      const cp = [ap[0] - ac[0], ap[1] - ac[1], ap[2] - ac[2]],
        d5 = dot(ab, cp),
        d6 = dot(ac, cp),
        vc = d1 * d4 - d3 * d2,
        vb = d5 * d2 - d1 * d6,
        va = d3 * d6 - d5 * d4;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) {
        v = d1 / (d1 - d3);
        w = 0;
      } else if (d6 >= 0 && d5 <= d6) {
        v = 0;
        w = 1;
      } else if (vb <= 0 && d2 >= 0 && d6 <= 0) {
        v = 0;
        w = d2 / (d2 - d6);
      } else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
        w = (d4 - d3) / (d4 - d3 + (d5 - d6));
        v = 1 - w;
      } else {
        const den = 1 / (va + vb + vc);
        v = vb * den;
        w = vc * den;
      }
    }
  }
  const q = [0, 1, 2].map((e) => a[e] + ab[e] * v + ac[e] * w);
  return (q[0] - x) ** 2 + (q[1] - y) ** 2 + (q[2] - z) ** 2;
}

/** Se o raio 3D que sai de `o` na direção `d` acerta um dos triângulos `tris` antes de `max` (Möller–Trumbore). */
function acerta(
  P: ArrayLike<number>,
  I: ArrayLike<number>,
  tris: ArrayLike<number>,
  o: number[],
  d: number[],
  max: number,
) {
  for (let n = 0; n < tris.length; n++) {
    const t = tris[n],
      a = I[t * 3] * 3,
      b = I[t * 3 + 1] * 3,
      c = I[t * 3 + 2] * 3;
    const e1x = P[b] - P[a],
      e1y = P[b + 1] - P[a + 1],
      e1z = P[b + 2] - P[a + 2],
      e2x = P[c] - P[a],
      e2y = P[c + 1] - P[a + 1],
      e2z = P[c + 2] - P[a + 2];
    const px = d[1] * e2z - d[2] * e2y,
      py = d[2] * e2x - d[0] * e2z,
      pz = d[0] * e2y - d[1] * e2x,
      det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-12) continue;
    const inv = 1 / det,
      tx = o[0] - P[a],
      ty = o[1] - P[a + 1],
      tz = o[2] - P[a + 2],
      uu = (tx * px + ty * py + tz * pz) * inv;
    if (uu < 0 || uu > 1) continue;
    const qx = ty * e1z - tz * e1y,
      qy = tz * e1x - tx * e1z,
      qz = tx * e1y - ty * e1x,
      vv = (d[0] * qx + d[1] * qy + d[2] * qz) * inv;
    if (vv < 0 || uu + vv > 1) continue;
    const s = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (s > 1e-6 && s < max) return true;
  }
  return false;
}

/**
 * Quanto a cabeça anda para a frente (+x; negativo = para trás) para o pescoço dela cair dentro da abertura do corpo.
 * `borda`: os pontos da borda da abertura do pescoço do corpo (xyz); `pele`: os da pele do pescoço da cabeça, já no
 * lugar (xyz). Mínimos quadrados das menores distâncias de cada ponto da borda à pele, descartando os piores (as tiras
 * soltas do recorte), mais um freio que prefere não mexer. Em unidades do jogo; `u` = olhos–queixo do corpo.
 */
export function ajusteFrenteTras(borda: ArrayLike<number>, pele: ArrayLike<number>, u: number): number {
  const E = ENCAIXE_CABECA,
    nb = borda.length / 3,
    np = pele.length / 3;
  if (nb < 3 || np < 3) return 0;
  const d2 = new Float64Array(nb),
    fica = Math.max(1, Math.round(nb * (1 - E.descarte)));
  const custo = (dx: number) => {
    for (let i = 0; i < nb; i++) {
      const bx = borda[i * 3] - dx,
        by = borda[i * 3 + 1],
        bz = borda[i * 3 + 2];
      let m = Infinity;
      for (let j = 0; j < np; j++) {
        const ex = pele[j * 3] - bx,
          ey = pele[j * 3 + 1] - by,
          ez = pele[j * 3 + 2] - bz,
          d = ex * ex + ey * ey + ez * ez;
        if (d < m) m = d;
      }
      d2[i] = m;
    }
    d2.sort();
    let s = 0;
    for (let i = 0; i < fica; i++) s += d2[i];
    return s / fica + E.freio * dx * dx;
  };
  let melhor = 0,
    menor = custo(0);
  for (let dx = -E.recuo * u; dx <= E.avanco * u + 1e-9; dx += E.passo * u) {
    const c = custo(dx);
    if (c < menor - 1e-12) {
      menor = c;
      melhor = dx;
    }
  }
  return melhor;
}

interface OpcoesGola {
  /** os triângulos e os vértices do corpo vêm primeiro na malha (comporPele) */
  ntCorpo: number;
  nvCorpo: number;
  /** a parte de cada triângulo da cabeça (depois dos do corpo): 1 pele, 2 cabelo, 3 detalhe do rosto; null = toda pele */
  mascaraCabeca: ArrayLike<number> | null;
  /** o y do queixo do corpo e a medida das cabeças trocadas nele (uTroca) */
  queixo: number;
  u: number;
  /** "corpo|cabeça": escolhe a cor, sempre a mesma para a combinação */
  semente: string;
  /** cores (rgb 0..255) das quais o pano foge: a do cabelo e a da pele */
  evitar?: number[][];
  /** o pixel branco da textura (u, v), quando a malha tem textura (a cor do pano vai por triângulo) */
  branco?: number[];
  /** GOLA.modo "pele": a cor da pele do corpo e a do rosto (rgb 0..255), para o degradê do pescoço */
  pele?: { corpo: number[]; cabeca: number[] };
  /** a parte de cada triângulo do corpo (1 pele): a roupa só é copiada onde o pescoço encosta nela (o decote) */
  mascaraCorpo?: ArrayLike<number> | null;
  /** o peitoral vestido (pose de bind): o que fica embaixo dele não é vão */
  cobertura?: Pick<Anim, "P" | "I">;
}

/** O que acabarPescoco acrescentou no fim da malha: `pele` triângulos de pele (os buracos fechados) e, depois deles,
 *  `gola` triângulos de pano. As ferramentas que conferem a pele usam. */
const EXTRAS = new WeakMap<object, { pele: number; gola: number }>();
export function extrasDoPescoco(A: object) {
  return EXTRAS.get(A) ?? { pele: 0, gola: 0 };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
/** distância de cor ponderada ("redmean"), rgb 0..255 */
function distCor(a: number[], b: number[]) {
  const r = (a[0] + b[0]) / 2,
    d = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  return Math.sqrt((2 + r / 256) * d[0] * d[0] + 4 * d[1] * d[1] + (2 + (255 - r) / 256) * d[2] * d[2]);
}
/** a menor diferença entre dois ângulos */
const difAng = (a: number, b: number) =>
  Math.abs(((((a - b) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);

/**
 * A pele montada (comporPele, já tingida) com o pescoço acabado: buracos laterais fechados, o fim do pescoço da cabeça
 * dentro do peito e, se ainda houver vão, a gola. Os triângulos do corpo e da cabeça continuam os mesmos, na mesma
 * ordem (as máscaras e a cobertura das roupas continuam valendo para eles); o que é novo vai no fim. Sem nada a fazer,
 * devolve a mesma pele.
 */
export function acabarPescoco(A: Anim, o: OpcoesGola): Anim {
  const G = GOLA,
    u = o.u,
    q = o.queixo,
    I = A.I,
    nt = I.length / 3,
    nv = A.P.length / 3,
    neck = juntaNoBind(A, "Neck");
  if (!neck || nt <= o.ntCorpo) return A;
  const parteTri = (t: number) => {
    const m = o.mascaraCabeca?.[t - o.ntCorpo];
    return m == null || m === 1 || m === 3 ? 1 : m === 2 ? 2 : 4;
  };
  // a pele da parte de baixo da cabeça (pescoço, queixo, nuca): o cabelo não conta (o pano fica por baixo dele)
  const cabeca: number[] = [],
    daCabeca: number[] = [],
    parteV = new Uint8Array(nv);
  for (let t = o.ntCorpo; t < nt; t++) {
    const pt = parteTri(t);
    for (let k = 0; k < 3; k++) parteV[I[t * 3 + k]] |= pt;
    const y = Math.min(A.P[I[t * 3] * 3 + 1], A.P[I[t * 3 + 1] * 3 + 1], A.P[I[t * 3 + 2] * 3 + 1]);
    if (y < q + 0.2 * u) daCabeca.push(t);
    if (pt === 1 && y < q + 0.4 * u) cabeca.push(t);
  }
  // o eixo do pescoço: a junta Head na frente/trás (a média da pele da cabeça saía do pescoço quando a cabeça traz um
  // resto de colo, e aí a abertura do pescoço nem dava a volta nele); de lado, a linha do meio do esqueleto
  const head = juntaNoBind(A, "Head");
  if (!head || !cabeca.length) return A;
  const ax = head[0],
    az = neck[2],
    alc = G.alcance * u,
    fundo = q - G.fundo * u,
    camada = G.camada * u;
  const corpo: number[] = [];
  for (let t = 0; t < o.ntCorpo; t++) {
    let cx = 0,
      cy = 0,
      cz = 0;
    for (let k = 0; k < 3; k++) {
      const v = I[t * 3 + k];
      cx += A.P[v * 3] / 3;
      cy += A.P[v * 3 + 1] / 3;
      cz += A.P[v * 3 + 2] / 3;
    }
    if (cy < fundo - 0.6 * u || cy > q + 1.2 * u || Math.hypot(cx - ax, cz - az) > alc + 0.6 * u) continue;
    corpo.push(t);
  }
  const P = Float32Array.from(A.P),
    fatiasCorpo = new Map<number, number[]>(),
    fatiaCorpo = (y: number) => {
      const k = Math.round(y / (0.02 * u));
      let s = fatiasCorpo.get(k);
      if (!s) {
        fatiar(P, I, corpo, k * 0.02 * u, (s = []));
        fatiasCorpo.set(k, s);
      }
      return s;
    };
  // olhando da borda para dentro da pele, não há outra camada logo ali: é buraco (a beira do colete, das placas e da
  // camisa por cima do corpo tem o corpo por baixo e é roupa)
  const buraco = (x: number, y: number, z: number, n: number[], perto: (p: number[], r: number) => number[]) => {
    const o = [x - n[0] * 0.02 * u, y - n[1] * 0.02 * u, z - n[2] * 0.02 * u];
    return !acerta(P, I, perto(o, G.porTras * u), o, [-n[0], -n[1], -n[2]], G.porTras * u);
  };
  const pertoCorpo = grade(P, I, corpo, 0.5 * u);
  // embaixo do peitoral vestido: olhando para fora da borda, a armadura está logo ali (aí não precisa de gola)
  const cob = o.cobertura,
    trisCob: number[] = [];
  if (cob)
    for (let t = 0; t < cob.I.length / 3; t++) {
      const y = cob.P[cob.I[t * 3] * 3 + 1];
      if (y > fundo - u && y < q + u) trisCob.push(t);
    }
  const pertoCob = cob && trisCob.length ? grade(cob.P, cob.I, trisCob, 0.5 * u) : null,
    // perto da peça, para dentro ou para fora: a Líder veste as peças da F01, que não batem com o corpo dela (a placa
    // fica ora por fora, ora por dentro da pele), e o pano virava um poncho por cima da armadura
    sobRoupa = (x: number, y: number, z: number) => {
      if (!cob || !pertoCob) return false;
      const lim = (G.sobRoupa * u) ** 2;
      for (const t of pertoCob([x, y, z], G.sobRoupa * u))
        if (dist2Triangulo(cob.P, cob.I[t * 3], cob.I[t * 3 + 1], cob.I[t * 3 + 2], x, y, z) < lim) return true;
      return false;
    };

  // (1) os laços da borda do corpo: os que não dão a volta no pescoço e são buraco de verdade fecham com pele
  const bordaCorpo = arestasDeBorda(A, o.ntCorpo),
    fechados = new Set<number>(),
    pele: number[][] = [];
  for (const laco of lacosDaBorda(bordaCorpo.arestas)) {
    let naZona = 0,
      buracos = 0,
      volta = 0;
    for (let i = 0; i < laco.length; i++) {
      const v = laco[i],
        w = laco[(i + 1) % laco.length],
        x = P[v * 3],
        y = P[v * 3 + 1],
        z = P[v * 3 + 2],
        r = Math.hypot(x - ax, z - az);
      // quantas voltas o laço dá em torno do eixo do pescoço (visto de cima)
      let d = Math.atan2(P[w * 3 + 2] - az, P[w * 3] - ax) - Math.atan2(z - az, x - ax);
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      volta += d;
      if (y < fundo || y > q + 1.0 * u || r > alc) continue;
      naZona++;
      if (buraco(x, y, z, bordaCorpo.normal.get(v)!, pertoCorpo)) buracos++;
    }
    if (naZona < laco.length * 0.6 || buracos < naZona * 0.5) continue;
    if (Math.abs(volta) > G.voltaLateral * Math.PI) continue; // dá a volta no pescoço: é a abertura dele (gola)
    pele.push(...costurar(laco, P, bordaCorpo.noSentido));
    for (const v of laco) fechados.add(v);
  }

  // (2) o fim do pescoço da cabeça (e o resto de colo que algumas cabeças trazem) que atravessa o peito volta para dentro
  // da primeira camada do corpo. Só a pele ligada ao pescoço: as tranças loiras caem na frente do ombro e a máscara
  // (pela cor) chamou de pele, mas são outra peça
  const pai = new Int32Array(nv).map((_, i) => i),
    raiz = (v: number): number => {
      while (pai[v] !== v) v = pai[v] = pai[pai[v]];
      return v;
    };
  for (let t = o.ntCorpo; t < nt; t++)
    if (parteTri(t) === 1) for (let k = 1; k < 3; k++) pai[raiz(I[t * 3 + k])] = raiz(I[t * 3]);
  const doPescoco = new Set<number>();
  for (let v = o.nvCorpo; v < nv; v++) {
    const y = P[v * 3 + 1];
    if (
      parteV[v] & 1 &&
      y > q - 0.7 * u &&
      y < q - 0.2 * u &&
      Math.hypot(P[v * 3] - ax, P[v * 3 + 2] - az) < G.raioPescoco * u
    )
      doPescoco.add(raiz(v));
  }
  for (let v = o.nvCorpo; v < nv; v++) {
    if (parteV[v] !== 1 || !doPescoco.has(raiz(v))) continue;
    const y = P[v * 3 + 1];
    if (y < q - G.fundo * u || y > q - G.recolherAcima * u) continue;
    const dx = P[v * 3] - ax,
      dz = P[v * 3 + 2] - az,
      r = Math.hypot(dx, dz);
    if (r < 1e-6) continue;
    const rb = alcanceRaio(fatiaCorpo(y), ax, az, dx / r, dz / r, alc, camada);
    // colado no peito (o colo); o que cai mais afastado (uma trança) fica
    if (rb > 0 && r > rb - 0.03 * u && r < rb + G.recolherFolga * u) {
      const k = Math.max(0, rb - 0.03 * u) / r;
      P[v * 3] = ax + dx * k;
      P[v * 3 + 2] = az + dz * k;
    }
  }

  // (3) os pontos que ficam para fora da pele do pescoço da cabeça na altura deles: o vão
  const fatias = new Map<number, number[]>(),
    fatiaCabeca = (y: number) => {
      const k = Math.round(y / (0.02 * u));
      let s = fatias.get(k);
      if (!s) {
        fatiar(P, I, cabeca, k * 0.02 * u, (s = []));
        fatias.set(k, s);
      }
      return s;
    };
  const vao: number[][] = []; // [ângulo, y, raio]
  for (const [v, n] of bordaCorpo.normal) {
    if (fechados.has(v)) continue;
    const x = P[v * 3],
      y = P[v * 3 + 1],
      z = P[v * 3 + 2],
      r = Math.hypot(x - ax, z - az);
    if (y < fundo || y > q + 1.0 * u || r > alc || r < 1e-6) continue;
    // dentro do pescoço da cabeça, escondido (só perto do eixo: o resto de colo de algumas cabeças não tapa buraco)
    if (
      r < G.raioPescoco * u &&
      alcanceRaio(fatiaCabeca(y), ax, az, (x - ax) / r, (z - az) / r, 1.8 * u, camada) >= r + 0.02 * u
    )
      continue;
    if (!buraco(x, y, z, n, pertoCorpo) || sobRoupa(x, y, z)) continue;
    vao.push([Math.atan2(z - az, x - ax), y, r]);
  }
  // e as bordas abertas da pele do pescoço da cabeça fora do corpo: o gerador das cabeças de busto tirou a pele com
  // |x| > 0,58 abaixo do queixo (o ombro do busto) e beliscou os lados do pescoço logo embaixo da mandíbula
  const bc = arestasDeBorda({ P, I }, daCabeca),
    pertoAtras = grade(P, I, [...corpo, ...daCabeca], 0.5 * u);
  for (const [v, n] of bc.normal) {
    if (parteV[v] !== 1) continue;
    const x = P[v * 3],
      y = P[v * 3 + 1],
      z = P[v * 3 + 2],
      r = Math.hypot(x - ax, z - az);
    // o fim do toco do pescoço (1,3 u abaixo do queixo) fica dentro do peito: só os furos de cima contam
    if (y < q - G.furoCabeca * u || y > q - 0.05 * u || r > alc || r < 1e-6) continue;
    if (alcanceRaio(fatiaCorpo(y), ax, az, (x - ax) / r, (z - az) / r, alc, camada) >= r + 0.02 * u) continue;
    if (!buraco(x, y, z, n, pertoAtras) || sobRoupa(x, y, z)) continue;
    vao.push([Math.atan2(z - az, x - ax), y, r]);
  }
  const gola = vao.length >= G.vaoMin ? golaEm(vao) : null;
  if (!pele.length && !gola && P.every((v, i) => v === A.P[i])) return A;

  // a malha: corpo e cabeça como estavam (a cabeça recolhida), os buracos fechados e o pano no fim
  const nG = gola ? gola.P.length / 3 : 0,
    nvT = nv + nG,
    Pn = new Float32Array(nvT * 3),
    Jn = new Uint8Array(nvT * 4),
    Wn = new Float32Array(nvT * 4);
  Pn.set(P);
  Jn.set(A.J);
  Wn.set(A.W);
  if (gola) {
    Pn.set(gola.P, nv * 3);
    Jn.set(gola.J, nv * 4);
    Wn.set(gola.W, nv * 4);
  }
  if (nvT > 65535) return A;
  const ntP = pele.length,
    ntG = gola ? gola.I.length / 3 : 0,
    In = new Uint16Array(I.length + (ntP + ntG) * 3),
    C = new Float32Array(A.C.length + (ntP + ntG) * 3);
  In.set(I);
  C.set(A.C);
  // a cor de um buraco fechado: a dos triângulos do corpo em volta dos vértices dele
  const corEmVolta = (v: number) => {
    for (let k = A.ini[v]; k < A.ini[v + 1]; k++) {
      const t = Math.floor(A.cantos[k] / 3);
      if (t < o.ntCorpo) return [A.C[t * 3], A.C[t * 3 + 1], A.C[t * 3 + 2]];
    }
    return null;
  };
  for (let i = 0; i < ntP; i++) {
    const tri = pele[i],
      cores = tri.map(corEmVolta).filter((c): c is number[] => !!c),
      cor = [0, 1, 2].map((e) => cores.reduce((s, c) => s + c[e], 0) / Math.max(1, cores.length));
    In.set(tri, I.length + i * 3);
    C.set(cores.length ? cor : [0.8, 0.55, 0.4], A.C.length + i * 3);
  }
  if (gola) {
    for (let k = 0; k < gola.I.length; k++) In[I.length + ntP * 3 + k] = gola.I[k] + nv;
    C.set(gola.C, A.C.length + ntP * 3);
  }
  let UV: Float32Array | undefined;
  if (A.UV) {
    UV = new Float32Array(A.UV.length + (ntP + ntG) * 6);
    UV.set(A.UV);
    const br = o.branco ?? [0, 0];
    for (let k = A.UV.length; k < UV.length; k += 2) {
      UV[k] = br[0];
      UV[k + 1] = br[1];
    }
  }
  const ini = new Uint32Array(nvT + 1);
  for (let k = 0; k < In.length; k++) ini[In[k] + 1]++;
  for (let v = 0; v < nvT; v++) ini[v + 1] += ini[v];
  const cantos = new Uint32Array(In.length),
    pos = ini.slice(0, nvT);
  for (let k = 0; k < In.length; k++) cantos[pos[In[k]]++] = k;
  const out: Anim = { ...A, P: Pn, J: Jn, W: Wn, I: In, C, UV, ini, cantos };
  EXTRAS.set(out, { pele: ntP, gola: ntG });
  return out;

  /** O pano: vértices (P, J, W, índices a partir de 0) e cores por triângulo. */
  function golaEm(vao: number[][]) {
    // até onde o pano vai em cada direção (coluna): do ponto descoberto mais baixo ao mais alto (espelhado: simétrico)
    const N = G.colunas,
      passo = (2 * Math.PI) / N,
      janela = 1.5 * passo,
      lo = new Float64Array(N).fill(Infinity),
      hi = new Float64Array(N).fill(-Infinity);
    for (const [th, y] of vao)
      for (const a of [th, -th])
        for (let i = 0; i < N; i++) {
          if (difAng(a, i * passo) > janela) continue;
          lo[i] = Math.min(lo[i], y);
          hi[i] = Math.max(hi[i], y);
        }
    const preencher = (a: Float64Array) => {
      const b = Float64Array.from(a);
      if (!b.some(Number.isFinite)) return false;
      for (let i = 0; i < N; i++) {
        if (Number.isFinite(b[i])) continue;
        let e = 1,
          d = 1;
        while (!Number.isFinite(b[(i - e + N) % N])) e++;
        while (!Number.isFinite(b[(i + d) % N])) d++;
        a[i] = (b[(i - e + N) % N] * d + b[(i + d) % N] * e) / (e + d);
      }
      return true;
    };
    if (!preencher(lo) || !preencher(hi)) return null;
    const teto = (i: number) => q + u * (G.topoFrente + ((G.topoTras - G.topoFrente) * (1 - Math.cos(i * passo))) / 2);
    for (let i = 0; i < N; i++) {
      lo[i] = Math.max(fundo, lo[i] - G.margemBaixo * u);
      hi[i] = Math.min(teto(i), hi[i] + G.margemCima * u);
      if (hi[i] - lo[i] < G.alturaMin * u) {
        hi[i] = Math.min(teto(i), lo[i] + G.alturaMin * u);
        lo[i] = Math.min(lo[i], hi[i] - G.alturaMin * u);
      }
    }
    // a bainha desce no máximo `inclinacao` u por radiano para os lados de um ponto fundo: em vez de uma língua
    // estreita, um bico largo (como o caimento de um pano)
    {
      const b = Float64Array.from(lo);
      for (let i = 0; i < N; i++)
        for (let j = 0; j < N; j++) lo[i] = Math.min(lo[i], b[j] + G.inclinacao * u * difAng(i * passo, j * passo));
    }
    const suavizar = (a: Float64Array, prender: (v: number, i: number) => number) => {
      for (let p = 0; p < 3; p++) {
        const b = Float64Array.from(a);
        for (let i = 0; i < N; i++) a[i] = prender(0.25 * b[(i + N - 1) % N] + 0.5 * b[i] + 0.25 * b[(i + 1) % N], i);
      }
    };
    const lo0 = Float64Array.from(lo),
      hi0 = Float64Array.from(hi);
    suavizar(lo, (v, i) => Math.min(v, lo0[i]));
    suavizar(hi, (v, i) => Math.min(teto(i), Math.max(v, hi0[i])));

    // o raio da primeira camada de pele (corpo e cabeça) em cada coluna, em níveis de altura
    let y0 = Infinity,
      y1 = -Infinity;
    for (let i = 0; i < N; i++) {
      y0 = Math.min(y0, lo[i] - 0.1 * u);
      y1 = Math.max(y1, hi[i] + 0.1 * u);
    }
    const L = Math.max(8, Math.min(60, Math.ceil((y1 - y0) / (0.06 * u)) + 1)),
      dy = (y1 - y0) / (L - 1),
      rc = new Float64Array(L * N).fill(NaN),
      rh = new Float64Array(L * N).fill(NaN),
      sh: number[] = [];
    for (let l = 0; l < L; l++) {
      const y = y0 + l * dy,
        sc = fatiaCorpo(y);
      fatiar(P, I, cabeca, y, sh);
      for (let i = 0; i < N; i++) {
        const dx = Math.cos(i * passo),
          dz = Math.sin(i * passo),
          a = alcanceRaio(sc, ax, az, dx, dz, alc, camada),
          b = alcanceRaio(sh, ax, az, dx, dz, 1.8 * u, camada);
        if (a > 0) rc[l * N + i] = a;
        if (b > 0) rh[l * N + i] = b;
      }
    }
    // buracos do corpo (sem pele no raio): interpola entre os níveis com pele; abaixo do primeiro, repete ele; acima do
    // último fica sem (o pano sobe abraçando o pescoço da cabeça)
    for (let i = 0; i < N; i++) {
      let ant = -1;
      for (let l = 0; l < L; l++) {
        const v = rc[l * N + i];
        if (Number.isNaN(v)) continue;
        if (ant < 0) for (let m = 0; m < l; m++) rc[m * N + i] = v;
        else
          for (let m = ant + 1; m < l; m++)
            rc[m * N + i] = rc[ant * N + i] + ((v - rc[ant * N + i]) * (m - ant)) / (l - ant);
        ant = l;
      }
    }
    const base = new Float64Array(L * N);
    for (let k = 0; k < L * N; k++) {
      const a = rc[k],
        b = rh[k];
      base[k] = Number.isNaN(a) ? b : Number.isNaN(b) ? a : Math.max(a, b);
    }
    // a pele do pescoço da cabeça onde ela falta (a nuca coberta de cabelo das deusas): a das colunas vizinhas, para a
    // dobra de cima do pano fechar no pescoço
    for (let l = 0; l < L; l++) {
      const linha = rh.subarray(l * N, l * N + N),
        b = Float64Array.from(linha);
      if (!b.some((v) => !Number.isNaN(v))) continue;
      for (let i = 0; i < N; i++) {
        if (!Number.isNaN(b[i])) continue;
        let e = 1,
          d = 1;
        while (Number.isNaN(b[(i - e + N) % N])) e++;
        while (Number.isNaN(b[(i + d) % N])) d++;
        linha[i] = (b[(i - e + N) % N] * d + b[(i + d) % N] * e) / (e + d);
      }
    }
    // um raio que escapa entre as camadas da roupa e acerta o ombro salta para fora dos vizinhos: vira buraco (o pano
    // seguia ele e fazia uma aba pontuda)
    for (let l = 0; l < L; l++) {
      const linha = base.subarray(l * N, l * N + N),
        b = Float64Array.from(linha);
      for (let i = 0; i < N; i++) {
        if (Number.isNaN(b[i])) continue;
        const viz = [-2, -1, 1, 2]
          .map((d) => b[(i + d + N) % N])
          .filter((v) => !Number.isNaN(v))
          .sort((x, y) => x - y);
        if (viz.length < 3) continue;
        const med = (viz[(viz.length - 1) >> 1] + viz[viz.length >> 1]) / 2;
        if (b[i] - med > G.salto * u) linha[i] = NaN;
      }
    }
    // sem pele nenhuma naquele raio: o vizinho (na volta e depois na altura)
    for (let l = 0; l < L; l++) {
      const linha = base.subarray(l * N, l * N + N),
        b = Float64Array.from(linha);
      if (!b.some((v) => !Number.isNaN(v))) continue;
      for (let i = 0; i < N; i++) {
        if (!Number.isNaN(b[i])) continue;
        let e = 1,
          d = 1;
        while (Number.isNaN(b[(i - e + N) % N])) e++;
        while (Number.isNaN(b[(i + d) % N])) d++;
        linha[i] = (b[(i - e + N) % N] * d + b[(i + d) % N] * e) / (e + d);
      }
    }
    for (let l = 0; l < L; l++) {
      if (!Number.isNaN(base[l * N])) continue;
      let m = 1;
      while (m < L && (l - m < 0 || Number.isNaN(base[(l - m) * N])) && (l + m >= L || Number.isNaN(base[(l + m) * N])))
        m++;
      const de = l - m >= 0 && !Number.isNaN(base[(l - m) * N]) ? l - m : l + m;
      if (de < 0 || de >= L) return null;
      base.copyWithin(l * N, de * N, de * N + N);
    }
    // o pano passa por fora de todo ponto descoberto (a beira larga da gola da camisa nos ombros, as tiras soltas)
    for (const [th, y, r] of vao) {
      const l0 = Math.round((y - y0) / dy);
      for (const a of [th, -th])
        for (let i = 0; i < N; i++) {
          const d = difAng(a, i * passo);
          if (d > passo) continue;
          const rr = r * Math.cos(d) + 0.02 * u;
          for (let l = Math.max(0, l0 - 1); l <= Math.min(L - 1, l0 + 1); l++)
            base[l * N + i] = Math.max(base[l * N + i], rr);
        }
    }
    // o maior raio de pele entre duas alturas da coluna (o pano passa por fora de tudo no trecho)
    const raioEntre = (i: number, ya: number, yb: number) => {
      const la = Math.max(0, Math.min(L - 1, Math.floor((Math.min(ya, yb) - y0) / dy))),
        lb = Math.max(0, Math.min(L - 1, Math.ceil((Math.max(ya, yb) - y0) / dy)));
      let m = 0;
      for (let l = la; l <= lb; l++) m = Math.max(m, base[l * N + i]);
      return m;
    };
    const raioEm = (i: number, y: number, de: Float64Array = base): number => {
      const f = Math.max(0, Math.min(L - 1, (y - y0) / dy)),
        l = Math.floor(f),
        l2 = Math.min(L - 1, l + 1),
        w = f - l,
        r = de[l * N + i] * (1 - w) + de[l2 * N + i] * w;
      return Number.isNaN(r) ? raioEm(i, y) : r;
    };

    // os anéis: dobra para dentro embaixo, K+1 anéis, dobra para dentro em cima
    // modo "pele": o mesmo formato, rente (sem o rolo de pano nem as dobras), com o degradê da pele do corpo à do rosto
    const dePele = G.modo === "pele" && !!o.pele,
      folga = dePele ? G.pescocoPele.folga : G.folga,
      espessura = dePele ? G.pescocoPele.espessura : G.espessura;
    const K = G.linhas,
      aneis = K + 3,
      raio = new Float64Array(aneis * N),
      alt = new Float64Array(aneis * N);
    for (let i = 0; i < N; i++)
      for (let r = 0; r < aneis; r++) {
        let y: number, rad: number;
        if (r === 0) {
          // a bainha de baixo entra na pele do corpo; a de cima, no pescoço da cabeça (sem fresta para ver por dentro)
          // (fundas: com a cabeça virando a borda não abre fresta)
          y = lo[i] - 0.03 * u;
          rad = Math.min(raioEm(i, lo[i], rc) - 0.07 * u, raioEm(i, lo[i], rc) * 0.88);
        } else if (r === aneis - 1) {
          y = hi[i] + 0.02 * u;
          rad = Math.min(raioEm(i, hi[i], rh) - 0.06 * u, raioEm(i, hi[i], rh) * 0.78);
        } else {
          const s = (r - 1) / K,
            h = (hi[i] - lo[i]) / K;
          y = lo[i] + (hi[i] - lo[i]) * s;
          rad =
            raioEntre(i, y - 0.6 * h, y + 0.6 * h) +
            u * (folga + (espessura - folga) * Math.pow(Math.sin(Math.PI * s), 0.7));
        }
        alt[r * N + i] = y;
        raio[r * N + i] = Math.max(0.12 * u, rad);
      }
    // alisa na volta sem entrar na pele (os anéis do meio)
    for (let r = 1; r < aneis - 1; r++) {
      const min = raio.slice(r * N, r * N + N);
      for (let p = 0; p < 2; p++) {
        const b = raio.slice(r * N, r * N + N);
        for (let i = 0; i < N; i++)
          raio[r * N + i] = Math.max(min[i], 0.25 * b[(i + N - 1) % N] + 0.5 * b[i] + 0.25 * b[(i + 1) % N]);
      }
    }
    // dobras do pano: uma ondulação leve na volta, que muda de fase de um anel para o outro
    const fase = (hash(o.semente) % 628) / 100;
    for (let r = 1; r < aneis - 1; r++)
      for (let i = 0; i < N; i++)
        if (!dePele) raio[r * N + i] += 0.025 * u * (1 + Math.sin(i * passo * 5 + r * 1.3 + fase));

    // pesos: o vértice de pele mais perto do corpo (embaixo) e do pescoço da cabeça (em cima)
    const vCorpo = [...new Set(corpo.flatMap((t) => [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]]))],
      vCabeca = [...new Set(cabeca.flatMap((t) => [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]]))].filter(
        (v) => P[v * 3 + 1] < q,
      ),
      maisPerto = (vs: number[], x: number, y: number, z: number) => {
        let m = Infinity,
          melhor = -1;
        for (const v of vs) {
          const d = (P[v * 3] - x) ** 2 + (P[v * 3 + 1] - y) ** 2 + (P[v * 3 + 2] - z) ** 2;
          if (d < m) {
            m = d;
            melhor = v;
          }
        }
        return melhor;
      };
    const nG = aneis * N,
      Pg = new Float32Array(nG * 3),
      Jg = new Uint8Array(nG * 4),
      Wg = new Float32Array(nG * 4);
    for (let r = 0; r < aneis; r++)
      for (let i = 0; i < N; i++) {
        const g = r * N + i,
          y = alt[g],
          x = ax + raio[g] * Math.cos(i * passo),
          z = az + raio[g] * Math.sin(i * passo);
        Pg[g * 3] = x;
        Pg[g * 3 + 1] = y;
        Pg[g * 3 + 2] = z;
        const s = Math.max(0, Math.min(1, (y - lo[i]) / Math.max(1e-6, hi[i] - lo[i]))),
          t = Math.max(0, (s - 0.45) / 0.55),
          f = t * t * (3 - 2 * t),
          vc = maisPerto(vCorpo, x, y, z),
          vk = f > 0 ? maisPerto(vCabeca, x, y, z) : -1,
          acum = new Map<number, number>();
        for (const [v, w] of [
          [vc, vk < 0 ? 1 : 1 - f],
          [vk, vk < 0 ? 0 : f],
        ])
          if (v >= 0 && w > 0)
            for (let k = 0; k < 4; k++) {
              const j = A.J[v * 4 + k],
                p = A.W[v * 4 + k] * w;
              if (p > 0) acum.set(j, (acum.get(j) ?? 0) + p);
            }
        const top = [...acum].sort((a, b) => b[1] - a[1]).slice(0, 4),
          soma = top.reduce((a, [, w]) => a + w, 0) || 1;
        for (let k = 0; k < 4; k++) {
          Jg[g * 4 + k] = top[k]?.[0] ?? 0;
          Wg[g * 4 + k] = (top[k]?.[1] ?? 0) / soma;
        }
      }

    // os triângulos (para fora) e a cor: um tecido longe da cor do cabelo e da pele; bainhas mais escuras
    const evitar = o.evitar ?? [],
      opcoes = G.cores
        .map((c) => ({ c, d: evitar.length ? Math.min(...evitar.map((e) => distCor(c, e))) : 0 }))
        .sort((a, b) => b.d - a.d)
        .slice(0, 3),
      cor = opcoes[hash(o.semente) % opcoes.length].c,
      Ig: number[] = [],
      Cg: number[] = [],
      ponto = (g: number) => [Pg[g * 3], Pg[g * 3 + 1], Pg[g * 3 + 2]];
    // um sentido só para a malha toda (a faixa é contínua), decidido numa face em pé do meio: virando triângulo a
    // triângulo pela direção radial, as dobras quase deitadas das bainhas saíam em zigue-zague, metade do avesso
    const meio = (aneis >> 1) * N,
      [p0, p1, p2] = [meio, meio + 1, meio + N + 1].map(ponto),
      e1 = [0, 1, 2].map((k) => p1[k] - p0[k]),
      e2 = [0, 1, 2].map((k) => p2[k] - p0[k]),
      inverter = (e1[1] * e2[2] - e1[2] * e2[1]) * (p0[0] - ax) + (e1[0] * e2[1] - e1[1] * e2[0]) * (p0[2] - az) < 0;
    for (let r = 0; r + 1 < aneis; r++)
      for (let i = 0; i < N; i++) {
        const a = r * N + i,
          b = r * N + ((i + 1) % N),
          c = (r + 1) * N + ((i + 1) % N),
          d = (r + 1) * N + i;
        for (const tri of [
          [a, b, c],
          [a, c, d],
        ]) {
          if (inverter) tri.reverse();
          Ig.push(...tri);
          if (dePele && o.pele) {
            // a cor do que está embaixo (a pele do corpo, ou a roupa onde a emenda cai na gola da camisa: o decote
            // continua desenhado), indo para a pele do rosto no alto, onde o pescoço encontra a cabeça
            const cen = [0, 1, 2].map((e) => (Pg[tri[0] * 3 + e] + Pg[tri[1] * 3 + e] + Pg[tri[2] * 3 + e]) / 3);
            let embaixo = -1,
              menor = Infinity,
              pele = -1,
              menorPele = Infinity;
            for (const t of pertoCorpo(cen, 0.8 * u)) {
              const d = dist2Triangulo(P, I[t * 3], I[t * 3 + 1], I[t * 3 + 2], cen[0], cen[1], cen[2]);
              if (d < menor) {
                menor = d;
                embaixo = t;
              }
              if (o.mascaraCorpo?.[t] === 1 && d < menorPele) {
                menorPele = d;
                pele = t;
              }
            }
            // colado na roupa: o decote continua desenhado; longe dela (sobre um buraco, a gola da Líder em cima do
            // lenço) é pele
            const deRoupa = embaixo >= 0 && o.mascaraCorpo && o.mascaraCorpo[embaixo] !== 1,
              fonte = deRoupa && Math.sqrt(menor) > G.pescocoPele.roupaAte * u ? pele : embaixo;
            const base = fonte >= 0 ? [0, 1, 2].map((e) => A.C[fonte * 3 + e] * 255) : o.pele.corpo,
              s = Math.max(0, Math.min(1, ((r - 0.5) / (aneis - 2) - 0.55) / 0.45)),
              k = s * s * (3 - 2 * s);
            Cg.push(...base.map((v, e) => Math.min(1, (v + (o.pele!.cabeca[e] - v) * k) / 255)));
            continue;
          }
          const bainha = r === 0 || r === aneis - 2 ? 0.74 : r === 1 || r === aneis - 3 ? 0.86 : 1,
            tom = bainha * (0.95 + 0.1 * ((hash(o.semente + ":" + Ig.length) % 1000) / 1000)) * (i % 2 ? 0.97 : 1.02);
          Cg.push(...cor.map((v) => Math.min(1, (v * tom) / 255)));
        }
      }
    return { P: Pg, J: Jg, W: Wg, I: Ig, C: Cg };
  }
}

/** matiz (graus), saturação e valor (0..1) de uma cor rgb 0..1 */
function hsv(r: number, g: number, b: number) {
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    d = mx - mn,
    h = !d
      ? 0
      : mx === r
        ? (60 * ((g - b) / d) + 360) % 360
        : mx === g
          ? 60 * ((b - r) / d) + 120
          : 60 * ((r - g) / d) + 240;
  return [h, mx ? d / mx : 0, mx];
}

/**
 * 2026-11-07 — os restos do cabelo original grudados na boca do pescoço do corpo sem cabeça (o F02 era ruiva: 32
 * triângulos vermelhos ficaram embaixo do queixo novo, uma "gargantilha" de carne viva, e o pescoço de pele copiava a
 * cor deles). Vermelho saturado perto do pescoço (GOLA.restos), numa ilha pequena que não desce além da boca do
 * pescoço (o lenço de verdade da Líder é uma peça grande e fica), mais os escuros avermelhados encostados: cada um
 * ganha a média da pele em volta (ou `pele`, rgb 0..255). Devolve triângulo → cor nova (0..1).
 */
export function restosDeCabeloNoPescoco(A: Anim, queixo: number, u: number, pele: number[]) {
  const R = GOLA.restos,
    nt = A.I.length / 3,
    out = new Map<number, number[]>(),
    neck = juntaNoBind(A, "Neck");
  if (!neck) return out;
  const rep = soldar(A.P, A.I, nt),
    porV = new Map<number, number[]>();
  for (let t = 0; t < nt; t++)
    for (let k = 0; k < 3; k++) {
      const v = rep[A.I[t * 3 + k]];
      (porV.get(v) ?? porV.set(v, []).get(v)!).push(t);
    }
  const viz = (t: number) => {
    const s = new Set<number>();
    for (let k = 0; k < 3; k++) for (const o of porV.get(rep[A.I[t * 3 + k]])!) if (o !== t) s.add(o);
    return s;
  };
  const cy = new Float32Array(nt),
    cr = new Float32Array(nt),
    cor = (t: number) => hsv(A.C[t * 3], A.C[t * 3 + 1], A.C[t * 3 + 2]),
    verm = (t: number) => {
      const [h, s, v] = cor(t);
      return (h <= 12 || h >= 348) && s >= 0.6 && v >= 90 / 255;
    },
    escuroVerm = (t: number) => {
      const [h, s, v] = cor(t);
      return v < 0.45 && (h <= 20 || h >= 340) && s >= 0.45;
    };
  for (let t = 0; t < nt; t++) {
    let x = 0,
      y = 0,
      z = 0;
    for (let k = 0; k < 3; k++) {
      const v = A.I[t * 3 + k];
      x += A.P[v * 3] / 3;
      y += A.P[v * 3 + 1] / 3;
      z += A.P[v * 3 + 2] / 3;
    }
    cy[t] = (y - queixo) / u;
    cr[t] = Math.hypot(x - neck[0], z - neck[2]) / u;
  }
  const naFaixa = (t: number) => cy[t] >= -R.baixo && cy[t] <= R.alto && cr[t] <= R.raio;
  const pego = new Set<number>(),
    visto = new Uint8Array(nt);
  for (let t = 0; t < nt; t++) {
    if (visto[t] || !naFaixa(t) || !verm(t)) continue;
    const ilha: number[] = [],
      fila = [t];
    visto[t] = 1;
    while (fila.length) {
      const a = fila.pop()!;
      ilha.push(a);
      for (const b of viz(a))
        if (!visto[b] && verm(b)) {
          visto[b] = 1;
          fila.push(b);
        }
    }
    if (ilha.length > R.ilhaMax || ilha.some((a) => cy[a] < -R.ilhaFundo || cr[a] > R.ilhaRaio)) continue;
    for (const a of ilha) if (naFaixa(a)) pego.add(a);
  }
  for (const t of [...pego]) for (const b of viz(t)) if (!pego.has(b) && naFaixa(b) && escuroVerm(b)) pego.add(b);
  // e a parte de baixo sombreada das mesmas mechas (cinza-acastanhada), até dois anéis de um limpo, atravessando um anel
  // de pele: sozinha essa regra pegaria a gola da camisa da heroína e o lenço da Líder, por isso só perto dos limpos
  let borda = [...pego];
  for (let anel = 0; anel < 2 && pego.size; anel++) {
    const prox: number[] = [];
    for (const t of borda)
      for (const b of viz(t)) {
        if (pego.has(b) || !naFaixa(b)) continue;
        if (cor(b)[2] < 0.45) {
          pego.add(b);
          prox.push(b);
        } else if (anel === 0) prox.push(b);
      }
    borda = prox;
  }
  for (const t of pego) {
    const ok = [...viz(t)].filter((b) => {
      if (pego.has(b) || verm(b) || escuroVerm(b)) return false;
      const [h, s, v] = cor(b);
      return h > 12 && h < 40 && s > 0.3 && v > 0.55;
    });
    out.set(
      t,
      ok.length
        ? [0, 1, 2].map((e) => ok.reduce((s, b) => s + A.C[b * 3 + e], 0) / ok.length)
        : pele.map((v) => v / 255),
    );
  }
  return out;
}
