/* ==== v8.0 — veste outra malha em pose T no esqueleto de um rig (as animações da heroína em outra personagem) ====
   Usado por tools/gerar-animacoes.ts quando o plano tem "vestir" (primeiro caso: a líder dos bandidos, mantenedor
   2026-10-25: "seriam as mesmas animações"). A malha nova é a saída de tools/pintar-modelo.ts (.glb em pose T, frente
   +Z, cor por face numa paleta).
   1. A malha nova vai para a altura da malha do rig. Marcos nas duas (chão, linha dos braços, topo; ombro e ponta da
      mão; o x médio dos pés; a virilha é uma fração fixa da altura dos braços) dão uma deformação por partes
      rig → nova (e a inversa). Serve para a malha de tools/reduzir-modelo.ts também (o samurai).
   2. Cada junta mantida vai para o lugar deformado: as rotações de repouso ficam, as translações de repouso e as
      matrizes inversas de bind são refeitas. As animações (rotações locais) servem como estão; a altura do quadril
      nos clips escala por `fatorQuadril`.
   3. Pesos: cada vértice novo, levado de volta ao espaço do rig, pega a média (pelo inverso da distância) dos pesos
      dos 6 vértices do rig mais próximos. O que fica longe do corpo do rig (pano solto) copia o peso do vértice preso
      mais perto andando pela malha: a manga vai com o braço, a barra com o quadril. */
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { poseGlobal, type M4, type Rig } from "./esqueleto.ts";

interface Marcos {
  chao: number;
  virilha: number;
  braco: number;
  topo: number;
  ombro: number;
  mao: number;
  pe: number;
  /** v8.1 — o cotovelo e o pulso (|x|): no rig, as juntas; na malha nova, lidos à mão (`bracoMarcos`) */
  cot?: number;
  pul?: number;
}

function marcos(P: ArrayLike<number>, ombroRig?: number): Marcos {
  let chao = Infinity,
    topo = -Infinity,
    mao = 0;
  for (let i = 0; i < P.length; i += 3) {
    chao = Math.min(chao, P[i + 1]);
    topo = Math.max(topo, P[i + 1]);
    mao = Math.max(mao, Math.abs(P[i]));
  }
  const h = topo - chao;
  const mediana = (a: number[]) => a.sort((x, y) => x - y)[a.length >> 1];
  const ys: number[] = [],
    pes: number[] = [];
  for (let i = 0; i < P.length; i += 3) {
    const x = Math.abs(P[i]),
      y = P[i + 1] - chao;
    if (x > mao * 0.7) ys.push(P[i + 1]);
    if (y < h * 0.04) pes.push(x);
  }
  const braco = mediana(ys);
  // virilha: a mesma fração da altura dos braços nas duas (medir enganava: a saia, o pano do meio da hakama)
  const virilha = chao + (braco - chao) * 0.64;
  // ombro: onde o braço engrossa — o |x| mais para dentro na faixa logo acima da linha do braço, fora do tronco
  // (sem esse cuidado o cabelo solto ao lado do tronco contaria); na malha do rig, o ombro vem do esqueleto
  let ombro = ombroRig ?? 0;
  if (!ombroRig) {
    const faixa: number[] = [];
    for (let i = 0; i < P.length; i += 3)
      if (Math.abs(P[i + 1] - braco) < h * 0.012 && Math.abs(P[i]) > h * 0.05) faixa.push(Math.abs(P[i]));
    faixa.sort((a, b) => a - b);
    ombro = faixa[Math.floor(faixa.length * 0.02)] ?? h * 0.09;
  }
  return { chao, virilha, braco, topo, ombro, mao, pe: mediana(pes) };
}

/** Linear por partes: os nós de `de` vão para os de `para` (fora deles, segue a inclinação do último trecho). */
function partes(de: number[], para: number[]) {
  return (v: number) => {
    let k = 0;
    while (k < de.length - 2 && v > de[k + 1]) k++;
    return para[k] + ((v - de[k]) * (para[k + 1] - para[k])) / (de[k + 1] - de[k]);
  };
}

/** Deformação de a para b (x por região: pernas pela abertura dos pés, braços do ombro à mão; y em 3 trechos). */
function deformacao(a: Marcos, b: Marcos) {
  const fy = partes([a.chao, a.virilha, a.braco, a.topo], [b.chao, b.virilha, b.braco, b.topo]);
  const escTronco = (b.topo - b.chao) / (a.topo - a.chao);
  // v8.1 — com o cotovelo e o pulso dos dois, o braço vai por eles (o M06: braço de cima normal, antebraço e punho
  // curtos; pela proporção da heroína o cotovelo caía no meio do bíceps e o braço dobrava ali)
  const fBraco =
    a.cot && a.pul && b.cot && b.pul
      ? partes([0, a.ombro, a.cot, a.pul, a.mao], [0, b.ombro, b.cot, b.pul, b.mao])
      : partes([0, a.ombro, a.mao], [0, b.ombro, b.mao]);
  return (p: number[]) => {
    const [x, y, z] = p,
      ax = Math.abs(x),
      s = Math.sign(x);
    // perna (abaixo da virilha) → tronco (até a metade do caminho à linha do braço): mistura das escalas de x
    const tp = Math.min(1, Math.max(0, (y - a.virilha) / ((a.braco - a.virilha) * 0.5)));
    const sx = (b.pe / a.pe) * (1 - tp) + escTronco * tp;
    // braço: na altura dos braços e para fora do ombro
    const noBraco = Math.abs(y - a.braco) < (a.topo - a.chao) * 0.08 && ax > a.ombro;
    const nx = noBraco ? s * fBraco(ax) : x * sx;
    return [nx, fy(y), z * escTronco];
  };
}

/** Pernas coladas na pose T (a deusa do outono nova): gira cada perna para fora, no quadril, até o x médio dos pés
 *  chegar a `alvo` (o do rig). O giro some suavemente até a virilha, para a coxa não rasgar do quadril. O pivô x é o
 *  meio da perna logo abaixo da virilha (só perto do corpo: o cabelo solto ao lado do quadril não conta). */
function abrirPernasDaMalha(P: Float64Array, m: Marcos, alvo: number) {
  const h = m.topo - m.chao;
  if (m.pe >= alvo) return "";
  const xs: number[] = [];
  for (let i = 0; i < P.length; i += 3) {
    const y = P[i + 1];
    if (y < m.virilha - h * 0.06 && y > m.virilha - h * 0.1 && Math.abs(P[i]) < h * 0.12) xs.push(Math.abs(P[i]));
  }
  xs.sort((a, b) => a - b);
  const px = xs.length ? (xs[0] + xs[xs.length - 1]) / 2 : m.pe,
    py = m.virilha + h * 0.03,
    a = Math.atan2(alvo - m.pe, py - m.chao),
    queda = h * 0.12;
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i],
      y = P[i + 1];
    if (y >= m.virilha || x === 0) continue;
    const t = Math.min(1, (m.virilha - y) / queda),
      w = t * t * (3 - 2 * t),
      s = Math.sign(x),
      f = s * a * w,
      dx = x - s * px,
      dy = y - py;
    P[i] = s * px + dx * Math.cos(f) - dy * Math.sin(f);
    P[i + 1] = py + dx * Math.sin(f) + dy * Math.cos(f);
  }
  return `vestir: pernas abertas ${((a * 180) / Math.PI).toFixed(1)}° (pés ${m.pe.toFixed(3)} → ${alvo.toFixed(3)}, pivô x ${px.toFixed(3)})`;
}

/** A malha em pose T de tools/pintar-modelo.ts (lida do .glb do exportador: posição, UV e a paleta). */
async function lerTpose(arquivo: string) {
  const b = readFileSync(arquivo),
    jl = b.readUInt32LE(12),
    g = JSON.parse(b.subarray(20, 20 + jl).toString("utf8"));
  const bin = Buffer.from(b.subarray(28 + jl));
  const vista = (i: number) => {
    const v = g.bufferViews[i];
    return bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
  };
  const f32 = (acc: number) => {
    const a = g.accessors[acc],
      s = vista(a.bufferView);
    return Float64Array.from(new Float32Array(s.buffer.slice(s.byteOffset, s.byteOffset + s.byteLength)));
  };
  const img = sharp(vista(g.images[0].bufferView));
  const meta = await img.metadata();
  return {
    P: f32(g.meshes[0].primitives[0].attributes.POSITION),
    UV: f32(g.meshes[0].primitives[0].attributes.TEXCOORD_0),
    tex: { dados: await img.removeAlpha().raw().toBuffer(), lado: meta.width ?? 1 },
  };
}

/** Inversa de uma matriz rígida com escala uniforme. */
function inversa(m: M4): M4 {
  const s2 = m[0] * m[0] + m[1] * m[1] + m[2] * m[2],
    o = new Float64Array(16);
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) o[c * 4 + r] = m[r * 4 + c] / s2;
  for (let r = 0; r < 3; r++) o[12 + r] = -(o[r] * m[12] + o[4 + r] * m[13] + o[8 + r] * m[14]);
  o[15] = 1;
  return o;
}

/**
 * Troca a malha do rig pela de `arquivo` e ajusta o esqueleto a ela (muda `rig` no lugar).
 * `nos`: as juntas mantidas (índices de nó, de cima para baixo); `ombro`: o nó do braço esquerdo (marco do ombro);
 * `panoEntrePernas`: o pano solto entre as pernas vai só com o quadril (tabardo).
 * Devolve o fator da altura do quadril para os clips e linhas de relatório.
 */
export async function vestirRig(
  rig: Rig,
  arquivo: string,
  nos: number[],
  ombro: number,
  panoEntrePernas = false,
  marcoPe?: number,
  abrirPernas = 0,
  pernasPorLado = false,
  ombroMedido = false,
  bracoMarcos?: { cotovelo: number; pulso: number },
  soltoLimite = 0.03,
  suavizarPesos = 0,
) {
  const nova = await lerTpose(arquivo);
  const glob = poseGlobal(rig, null, 0);
  // posição de bind de cada junta da skin (a inversa da ibm)
  const bindPos = (no: number) => {
    const m = inversa(rig.ibm[rig.juntas.indexOf(no)]);
    return [m[12], m[13], m[14]];
  };
  // v8.1 — `ombroMedido`: o marco do ombro do rig medido na malha dele, como o da malha nova. Com o da junta (o padrão
  // antigo), a junta do braço ficava exatamente no marco, fora da regra do braço, e não se movia: nos corpos largos do
  // Tripo (M06, F06) ela ficava dentro do deltoide e o ombro "entrava" ao baixar o braço (mantenedor, 2026-11-01)
  const mr = marcos(rig.P, ombroMedido ? undefined : Math.abs(bindPos(ombro)[0]));
  // a malha nova na altura da do rig (mesmo chão)
  const mn0 = marcos(nova.P);
  const e = (mr.topo - mr.chao) / (mn0.topo - mn0.chao);
  for (let i = 0; i < nova.P.length; i += 3) {
    nova.P[i] *= e;
    nova.P[i + 1] = mr.chao + (nova.P[i + 1] - mn0.chao) * e;
    nova.P[i + 2] *= e;
  }
  let abertura = "";
  if (abrirPernas) {
    // já na altura do rig; `abrirPernas` = quanto do caminho até a abertura do rig (1 = igual à heroína)
    const m0 = marcos(nova.P);
    abertura = abrirPernasDaMalha(nova.P, m0, m0.pe + (mr.pe - m0.pe) * abrirPernas);
  }
  const mn = marcos(nova.P);
  // Mantém a base lateral das pernas quando o modelo novo está em pose muito fechada; evita o passo cruzado ao vestir.
  if (marcoPe != null) mn.pe = marcoPe;
  if (bracoMarcos) {
    const junta = (re: RegExp) => nos.find((no) => re.test(rig.nos[no].name ?? ""));
    const cot = junta(/LeftForeArm$/),
      pul = junta(/LeftHand$/);
    if (cot !== undefined && pul !== undefined) {
      mr.cot = Math.abs(bindPos(cot)[0]);
      mr.pul = Math.abs(bindPos(pul)[0]);
      mn.cot = bracoMarcos.cotovelo * (mn.topo - mn.chao);
      mn.pul = bracoMarcos.pulso * (mn.topo - mn.chao);
    }
  }
  const paraNova = deformacao(mr, mn),
    paraRig = deformacao(mn, mr);

  /* esqueleto: cada junta mantida no lugar deformado; rotação de repouso igual */
  const quadrilAntes = rig.nos[nos[0]].translation ?? [0, 1, 0];
  const novaGlob = new Map<number, M4>();
  const globDe = (no: number) => novaGlob.get(no) ?? glob[no];
  for (const no of nos) {
    const pos = paraNova(bindPos(no));
    const pai = rig.pais[no];
    // translação local = inversa(global do pai) × posição nova
    const ip = pai >= 0 ? inversa(globDe(pai)) : new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const t = [0, 1, 2].map((r) => ip[r] * pos[0] + ip[4 + r] * pos[1] + ip[8 + r] * pos[2] + ip[12 + r]);
    rig.nos[no] = { ...rig.nos[no], translation: t };
    // global nova e bind novo: as rotações não mudam (nem as dos pais), só a posição
    const g = Float64Array.from(glob[no]),
      bindG = inversa(rig.ibm[rig.juntas.indexOf(no)]);
    for (const m of [g, bindG]) [m[12], m[13], m[14]] = pos;
    novaGlob.set(no, g);
    rig.ibm[rig.juntas.indexOf(no)] = inversa(bindG);
  }

  /* pesos: média dos 6 vértices do rig mais próximos, no espaço do rig */
  const nvR = rig.P.length / 3,
    cel = (mr.topo - mr.chao) / 80,
    grade = new Map<string, number[]>();
  const ch = (x: number, y: number, z: number) =>
    `${Math.floor(x / cel)},${Math.floor(y / cel)},${Math.floor(z / cel)}`;
  for (let v = 0; v < nvR; v++) {
    const k = ch(rig.P[v * 3], rig.P[v * 3 + 1], rig.P[v * 3 + 2]);
    const l = grade.get(k) ?? [];
    l.push(v);
    grade.set(k, l);
  }
  const nv = nova.P.length / 3,
    J = new Float64Array(nv * 4),
    W = new Float64Array(nv * 4);
  const solto: number[] = [];
  for (let v = 0; v < nv; v++) {
    const q = paraRig([nova.P[v * 3], nova.P[v * 3 + 1], nova.P[v * 3 + 2]]);
    const gx = Math.floor(q[0] / cel),
      gy = Math.floor(q[1] / cel),
      gz = Math.floor(q[2] / cel);
    let perto: [number, number][] = [],
      r = 1;
    for (; r <= 12 && perto.length < 6; r++) {
      perto = [];
      for (let a = -r; a <= r; a++)
        for (let b = -r; b <= r; b++)
          for (let c = -r; c <= r; c++)
            for (const u of grade.get(`${gx + a},${gy + b},${gz + c}`) ?? [])
              perto.push([
                (rig.P[u * 3] - q[0]) ** 2 + (rig.P[u * 3 + 1] - q[1]) ** 2 + (rig.P[u * 3 + 2] - q[2]) ** 2,
                u,
              ]);
    }
    perto.sort((a, b) => a[0] - b[0]);
    const soma = new Map<number, number>();
    for (const [d, u] of perto.slice(0, 6)) {
      const f = 1 / (Math.sqrt(d) + cel * 0.1);
      for (let k = 0; k < 4; k++) {
        const w = rig.W[u * 4 + k];
        if (w > 0) soma.set(rig.J[u * 4 + k], (soma.get(rig.J[u * 4 + k]) ?? 0) + w * f);
      }
    }
    const top = [...soma.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4),
      tot = top.reduce((s, x) => s + x[1], 0) || 1;
    top.forEach(([j, w], k) => {
      J[v * 4 + k] = j;
      W[v * 4 + k] = w / tot;
    });
    // v8.1 — `soltoLimite`: num corpo largo (o quadril e o busto da F06 longe da malha da heroína) não é pano: com o
    // limite de 3% virava "solto" e copiava o peso de um vértice só, um bloco duro que vincava a cintura ao mexer
    if (!perto.length || Math.sqrt(perto[0][0]) > (mr.topo - mr.chao) * soltoLimite) solto.push(v);
  }
  /* pano solto (longe do corpo do rig: a manga larga, a barra do quimono) misturava pesos de partes distantes (braço
     com quadril) e esticava em pontas: ele vai com o que o segura — o vértice preso mais perto ANDANDO PELA MALHA (a
     manga é ligada ao braço, a barra ao quadril; pela coluna, a barra embaixo do braço da pose T ia com o braço).
     Peça solta sem caminho até um preso: o preso mais próximo em linha reta. */
  const ehSolto = new Uint8Array(nv);
  for (const v of solto) ehSolto[v] = 1;
  // solda (a malha do exportador tem as faces separadas) e vizinhos
  const sold = new Map<string, number>(),
    idSold = new Uint32Array(nv);
  for (let v = 0; v < nv; v++) {
    const k = `${Math.round(nova.P[v * 3] * 1e5)},${Math.round(nova.P[v * 3 + 1] * 1e5)},${Math.round(nova.P[v * 3 + 2] * 1e5)}`;
    let s = sold.get(k);
    if (s === undefined) sold.set(k, (s = sold.size));
    idSold[v] = s;
  }
  const ns = sold.size,
    rep = new Int32Array(ns).fill(-1), // um vértice original de cada soldado
    viz: number[][] = Array.from({ length: ns }, () => []);
  for (let v = 0; v < nv; v++) if (rep[idSold[v]] < 0 || !ehSolto[v]) rep[idSold[v]] = v;
  for (let t = 0; t < nv; t += 3)
    for (let k = 0; k < 3; k++) {
      const a = idSold[t + k],
        b = idSold[t + ((k + 1) % 3)];
      if (a !== b) {
        viz[a].push(b);
        viz[b].push(a);
      }
    }
  // Dijkstra de todos os presos ao mesmo tempo; `origem` = o preso que chegou primeiro
  const dist = new Float64Array(ns).fill(Infinity),
    origem = new Int32Array(ns).fill(-1),
    fila: [number, number][] = [];
  const sobe = (i: number) => {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (fila[p][0] <= fila[i][0]) break;
      [fila[p], fila[i]] = [fila[i], fila[p]];
      i = p;
    }
  };
  const tira = () => {
    const topo = fila[0],
      ult = fila.pop()!;
    if (fila.length) {
      fila[0] = ult;
      for (let i = 0; ;) {
        const a = i * 2 + 1,
          b = a + 1;
        let m = i;
        if (a < fila.length && fila[a][0] < fila[m][0]) m = a;
        if (b < fila.length && fila[b][0] < fila[m][0]) m = b;
        if (m === i) break;
        [fila[m], fila[i]] = [fila[i], fila[m]];
        i = m;
      }
    }
    return topo;
  };
  for (let s = 0; s < ns; s++)
    if (!ehSolto[rep[s]]) {
      dist[s] = 0;
      origem[s] = rep[s];
      fila.push([0, s]);
      sobe(fila.length - 1);
    }
  const pos = (s: number) => [nova.P[rep[s] * 3], nova.P[rep[s] * 3 + 1], nova.P[rep[s] * 3 + 2]];
  while (fila.length) {
    const [d, s] = tira();
    if (d > dist[s]) continue;
    const ps = pos(s);
    for (const u of viz[s]) {
      const pu = pos(u),
        nd = d + Math.hypot(pu[0] - ps[0], pu[1] - ps[1], pu[2] - ps[2]);
      if (nd < dist[u]) {
        dist[u] = nd;
        origem[u] = origem[s];
        fila.push([nd, u]);
        sobe(fila.length - 1);
      }
    }
  }
  const presos = [...Array(nv).keys()].filter((v) => !ehSolto[v]);
  let semCaminho = 0;
  for (const v of solto) {
    let melhor = origem[idSold[v]];
    if (melhor < 0) {
      semCaminho++;
      let md = Infinity;
      for (const u of presos) {
        const d =
          (nova.P[u * 3] - nova.P[v * 3]) ** 2 +
          (nova.P[u * 3 + 1] - nova.P[v * 3 + 1]) ** 2 +
          (nova.P[u * 3 + 2] - nova.P[v * 3 + 2]) ** 2;
        if (d < md) {
          md = d;
          melhor = u;
        }
      }
    }
    if (melhor < 0) continue;
    for (let k = 0; k < 4; k++) {
      J[v * 4 + k] = J[melhor * 4 + k];
      W[v * 4 + k] = W[melhor * 4 + k];
    }
  }
  // `panoEntrePernas` (o tabardo dos cavaleiros): pano solto entre as pernas, abaixo da virilha, só no quadril —
  // metade com cada coxa, rasgava ao meio quando as pernas abrem no golpe. Fora do plano que pede, não: a calça larga
  // dos bandidos também fica longe do corpo do rig e rasgava das pernas
  const quadril = rig.juntas.indexOf(nos[0]);
  let entrePernas = 0;
  for (const v of panoEntrePernas ? solto : [])
    if (nova.P[v * 3 + 1] < mn.virilha && Math.abs(nova.P[v * 3]) < mn.pe * 0.6) {
      J.fill(0, v * 4, v * 4 + 4);
      W.fill(0, v * 4, v * 4 + 4);
      J[v * 4] = quadril;
      W[v * 4] = 1;
      entrePernas++;
    }
  // v8.1 — `suavizarPesos`: médias com os vizinhos pela malha soldada (vezes): a passagem de um osso a outro fica
  // gradual (sem o degrau na cintura); antes de `pernasPorLado`, que limpa o que cruzar de uma coxa à outra
  if (suavizarPesos > 0) {
    let pesos: Map<number, number>[] = Array.from({ length: ns }, (_, s) => {
      const v = rep[s],
        p = new Map<number, number>();
      for (let k = 0; k < 4; k++) if (W[v * 4 + k] > 0) p.set(J[v * 4 + k], W[v * 4 + k]);
      return p;
    });
    for (let passo = 0; passo < suavizarPesos; passo++)
      pesos = pesos.map((p, s) => {
        const acc = new Map(p);
        for (const u of viz[s]) for (const [j, w] of pesos[u]) acc.set(j, (acc.get(j) ?? 0) + w);
        const top = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4),
          tot = top.reduce((a, b) => a + b[1], 0) || 1;
        return new Map(top.map(([j, w]) => [j, w / tot]));
      });
    for (let v = 0; v < nv; v++) {
      J.fill(0, v * 4, v * 4 + 4);
      W.fill(0, v * 4, v * 4 + 4);
      [...pesos[idSold[v]]].forEach(([j, w], k) => {
        J[v * 4 + k] = j;
        W[v * 4 + k] = w;
      });
    }
  }
  // v8.1 — `pernasPorLado`: abaixo da virilha cada vértice só segue os ossos da perna do lado dele (coxas que se
  // encostam, o M06: o lado de dentro de uma pegava peso da outra e virava tiras soltas ao andar)
  let porLado = 0;
  if (pernasPorLado) {
    const ladoDe = new Map<number, number>(); // índice da junta na skin → lado (sinal do x) das juntas de perna
    for (const no of nos) {
      if (!/Leg|Foot|Toe/.test(rig.nos[no].name ?? "")) continue;
      ladoDe.set(rig.juntas.indexOf(no), Math.sign(globDe(no)[12]));
    }
    const coxas = nos.filter((no) => /UpLeg/.test(rig.nos[no].name ?? ""));
    const coxa = (s: number) =>
      [...ladoDe].find(([j, l]) => l === s && /UpLeg/.test(rig.nos[rig.juntas[j]].name ?? ""))?.[0];
    // o lado: em relação ao meio das duas coxas (não x = 0)
    const meio = coxas.reduce((a, no) => a + globDe(no)[12], 0) / (coxas.length || 1);
    for (let v = 0; v < nv; v++) {
      if (nova.P[v * 3 + 1] >= mn.virilha) continue;
      const s = Math.sign(nova.P[v * 3] - meio);
      let tot = 0,
        mudou = false;
      for (let k = 0; k < 4; k++) {
        const l = ladoDe.get(J[v * 4 + k]);
        if (W[v * 4 + k] && l !== undefined && l !== s) {
          W[v * 4 + k] = 0;
          mudou = true;
        }
        tot += W[v * 4 + k];
      }
      if (!mudou) continue;
      porLado++;
      if (tot > 0) for (let k = 0; k < 4; k++) W[v * 4 + k] /= tot;
      else {
        J.fill(0, v * 4, v * 4 + 4);
        W.fill(0, v * 4, v * 4 + 4);
        J[v * 4] = coxa(s) ?? quadril;
        W[v * 4] = 1;
      }
    }
  }
  // a translação do quadril nos clips está no espaço do pai dele: a razão das alturas de repouso nesse espaço
  const fatorQuadril = rig.nos[nos[0]].translation![1] / quadrilAntes[1];
  rig.P = nova.P;
  rig.UV = nova.UV;
  rig.J = J;
  rig.W = W;
  rig.I = Uint32Array.from({ length: nv }, (_, i) => i);
  rig.tex = nova.tex;
  const f3 = (v: number) => v.toFixed(3);
  return {
    fatorQuadril,
    /** por vértice da malha nova (a ordem dos triângulos dela): 1 = pano solto, longe do corpo (o cabelo comprido) */
    soltos: ehSolto,
    info: [
      `vestir: marcos do rig  virilha ${f3(mr.virilha)} braço ${f3(mr.braco)} topo ${f3(mr.topo)} ombro ${f3(mr.ombro)} mão ${f3(mr.mao)} pé ${f3(mr.pe)}`,
      `vestir: marcos da nova virilha ${f3(mn.virilha)} braço ${f3(mn.braco)} topo ${f3(mn.topo)} ombro ${f3(mn.ombro)} mão ${f3(mn.mao)} pé ${f3(mn.pe)}`,
      `vestir: ${nv / 3} triângulos, quadril × ${fatorQuadril.toFixed(3)}, ${solto.length} de ${nv} vértices soltos (pano longe do corpo do rig; ${semCaminho} sem caminho pela malha, ${entrePernas} entre as pernas → quadril)`,
      ...(abertura ? [abertura] : []),
      ...(pernasPorLado ? [`vestir: ${porLado} vértices das pernas só com os ossos do lado deles`] : []),
    ],
  };
}
