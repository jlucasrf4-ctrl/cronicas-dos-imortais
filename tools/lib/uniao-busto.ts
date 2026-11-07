/** Recorte e costura de um busto completo já alinhado e pesado no esqueleto do corpo. Sem I/O ou estado global. */
import type { Anim } from "../../src/render/gl/esqueleto.ts";

type V3 = [number, number, number];
type V2 = [number, number];
type Origem = 0 | 1 | 2;
type NomeCostura = "cintura" | "bracoEsquerdo" | "bracoDireito";
type Canto = { v: number; uv: V2 };
type Plano = { eixo: 1 | 2; valor: number; sinal: 1 | -1; nome: NomeCostura };

export interface AjusteUniaoBusto {
  cinturaCorpo: number;
  cinturaBusto: number;
  bracoCorpo: number;
  bracoBusto: number;
  /** Pixel branco do atlas compartilhado. */
  branco: V2;
  /** Cor RGB 0..1 da pele do busto para as pontes; C costuma ser branco nas regiões texturizadas. */
  corBusto?: V3;
  amostrasAnel?: number;
  tolerancia?: number;
  /** Cabelo e adornos conservam a superfície original, sem virar contornos de braços/cintura. */
  preservarTriangulosBusto?: ArrayLike<number>;
  /** Limite anatômico independente da cintura; bustos curtos exigem costura mais alta. */
  alturaMinBracos?: number;
}

export interface RelatorioContornoBusto {
  nome: NomeCostura;
  origem: "corpo" | "busto";
  eixo: number;
  plano: number;
  arestas: number;
  componentes: number;
  verticesAbertos: number;
  verticesNaoManifold: number;
  pontos: number;
  caixa: { min: V3; max: V3 } | null;
  extremos?: { p: V3; grau: number }[];
}

export interface RelatorioUniaoBusto {
  contornos: RelatorioContornoBusto[];
  problemas: string[];
  triangulosCorpo: number;
  triangulosBusto: number;
  triangulosPonte: number;
  maiorArestaPonte: number;
  vertices: number;
  triangulos: number;
}

export class ErroUniaoBusto extends Error {
  readonly relatorio: RelatorioUniaoBusto;
  constructor(message: string, relatorio: RelatorioUniaoBusto) {
    super(message);
    this.name = "ErroUniaoBusto";
    this.relatorio = relatorio;
  }
}

/** Os dois inputs precisam usar juntas, inversas de bind e atlas iguais. As entradas nunca são alteradas. */
export function unirBustoIntegral(corpo: Anim, busto: Anim, ajuste: AjusteUniaoBusto) {
  const eps = ajuste.tolerancia ?? 1e-5;
  if (ajuste.preservarTriangulosBusto && ajuste.preservarTriangulosBusto.length !== busto.I.length / 3)
    throw new Error("Máscara de preservação do busto com tamanho inválido.");
  const relatorio: RelatorioUniaoBusto = {
    contornos: [],
    problemas: [],
    triangulosCorpo: 0,
    triangulosBusto: 0,
    triangulosPonte: 0,
    maiorArestaPonte: 0,
    vertices: 0,
    triangulos: 0,
  };
  const falhar = (mensagem: string): never => {
    relatorio.problemas.push(mensagem);
    throw new ErroUniaoBusto(mensagem, relatorio);
  };
  if (!(ajuste.cinturaBusto > ajuste.cinturaCorpo + eps))
    falhar("A cintura do busto precisa ficar acima do corte do corpo.");
  if (!(ajuste.bracoCorpo > ajuste.bracoBusto + eps && ajuste.bracoBusto > 0))
    falhar("O corte dos braços antigos precisa ficar para fora do corte do busto.");
  if (corpo.juntas.join("|") !== busto.juntas.join("|") || corpo.pais.join("|") !== busto.pais.join("|"))
    falhar("Os inputs não usam o mesmo esqueleto.");
  if (corpo.ibm.length !== busto.ibm.length || corpo.ibm.some((v, i) => Math.abs(v - busto.ibm[i]) > eps))
    falhar("As inversas de bind dos inputs são diferentes.");
  if (corpo.tex && busto.tex && corpo.tex !== busto.tex)
    falhar("Os inputs precisam apontar para o mesmo atlas de textura.");
  for (const [nome, a] of [
    ["corpo", corpo],
    ["busto", busto],
  ] as const) {
    const nv = a.P.length / 3,
      nt = a.I.length / 3;
    if (
      !Number.isInteger(nv) ||
      !Number.isInteger(nt) ||
      a.J.length !== nv * 4 ||
      a.W.length !== nv * 4 ||
      a.C.length !== nt * 3 ||
      (a.UV && a.UV.length !== nt * 6)
    )
      falhar(`${nome}: tamanhos de atributos inválidos.`);
    if (!a.P.every(Number.isFinite) || !a.W.every(Number.isFinite) || !a.C.every(Number.isFinite))
      falhar(`${nome}: atributo não finito.`);
  }

  const P = [...corpo.P, ...busto.P],
    J = [...corpo.J, ...busto.J],
    W = [...corpo.W, ...busto.W];
  const deslocamento = corpo.P.length / 3;
  const I: number[] = [],
    C: number[] = [],
    UV: number[] = [],
    origens: Origem[] = [],
    fontes: number[] = [];
  const temUV = !!(corpo.UV || busto.UV || corpo.tex || busto.tex);
  const caches: [Map<string, number[]>, Map<string, number[]>] = [new Map(), new Map()];
  const planosCorpo: Plano[] = [
    { eixo: 1, valor: ajuste.cinturaCorpo, sinal: -1, nome: "cintura" },
    { eixo: 2, valor: -ajuste.bracoCorpo, sinal: -1, nome: "bracoEsquerdo" },
    { eixo: 2, valor: ajuste.bracoCorpo, sinal: 1, nome: "bracoDireito" },
  ];
  const planosBusto: Plano[] = [
    { eixo: 1, valor: ajuste.cinturaBusto, sinal: 1, nome: "cintura" },
    { eixo: 2, valor: -ajuste.bracoBusto, sinal: 1, nome: "bracoEsquerdo" },
    { eixo: 2, valor: ajuste.bracoBusto, sinal: -1, nome: "bracoDireito" },
  ];
  const ponto = (v: number): V3 => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
  const distancia = (a: number, b: number) =>
    Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]);
  function pesos(v: number) {
    const p = new Map<number, number>();
    for (let k = 0; k < 4; k++) p.set(J[v * 4 + k], (p.get(J[v * 4 + k]) ?? 0) + W[v * 4 + k]);
    return p;
  }
  function misturarPesos(a: Map<number, number>, b: Map<number, number>, f: number) {
    const p = new Map<number, number>();
    for (const [origem, peso] of [
      [a, 1 - f],
      [b, f],
    ] as const)
      for (const [j, w] of origem) p.set(j, (p.get(j) ?? 0) + w * peso);
    return p;
  }
  function adicionar(p: V3, pesos: Map<number, number>) {
    const v = P.length / 3;
    P.push(...p);
    const top = [...pesos]
      .filter(([, w]) => w > 1e-9)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    const total = top.reduce((s, [, w]) => s + w, 0);
    if (!(total > 0)) falhar("Um vértice da emenda ficou sem peso de skinning.");
    for (let k = 0; k < 4; k++) {
      J.push(top[k]?.[0] ?? 0);
      W.push((top[k]?.[1] ?? 0) / total);
    }
    return v;
  }
  function emitir(a: Canto, b: Canto, c: Canto, cor: V3, origem: Origem, fonte: number) {
    if (new Set([a.v, b.v, c.v]).size !== 3) return false;
    const u = ponto(b.v).map((x, e) => x - P[a.v * 3 + e]),
      v = ponto(c.v).map((x, e) => x - P[a.v * 3 + e]);
    const area = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]);
    if (area <= eps * eps) return false;
    I.push(a.v, b.v, c.v);
    C.push(...cor);
    origens.push(origem);
    fontes.push(fonte);
    if (temUV) UV.push(...a.uv, ...b.uv, ...c.uv);
    if (origem === 0) relatorio.triangulosCorpo++;
    else if (origem === 1) relatorio.triangulosBusto++;
    else {
      relatorio.triangulosPonte++;
      relatorio.maiorArestaPonte = Math.max(
        relatorio.maiorArestaPonte,
        distancia(a.v, b.v),
        distancia(b.v, c.v),
        distancia(c.v, a.v),
      );
    }
    return true;
  }
  function chavePlano(p: Plano, cel: number[]) {
    return `${p.eixo}:${p.valor}:${cel.join(",")}`;
  }
  function acharNoPlano(p: Plano, pos: V3, origem: 0 | 1) {
    const cel = pos.map((x) => Math.floor(x / eps));
    // A mesma interseção, calculada em sentidos opostos, pode cair de cada lado de meia célula
    // por um único ULP. O hash só localiza candidatos: a solda usa a distância real.
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++) {
          for (const v of caches[origem].get(chavePlano(p, [cel[0] + x, cel[1] + y, cel[2] + z])) ?? []) {
            if (Math.hypot(P[v * 3] - pos[0], P[v * 3 + 1] - pos[1], P[v * 3 + 2] - pos[2]) <= eps) return v;
          }
        }
    return undefined;
  }
  function registrarNoPlano(p: Plano, pos: V3, origem: 0 | 1, v: number) {
    const chave = chavePlano(
      p,
      pos.map((x) => Math.floor(x / eps)),
    );
    const lista = caches[origem].get(chave) ?? [];
    lista.push(v);
    caches[origem].set(chave, lista);
  }
  function canonico(c: Canto, p: Plano, origem: 0 | 1) {
    if (Math.abs(P[c.v * 3 + p.eixo] - p.valor) > eps) return c;
    const pos = ponto(c.v),
      anterior = acharNoPlano(p, pos, origem);
    if (anterior != null) return { v: anterior, uv: c.uv };
    registrarNoPlano(p, pos, origem, c.v);
    return c;
  }
  function cortar(entrada: Canto[], plano: Plano, origem: 0 | 1) {
    const pol: Canto[] = [],
      original = entrada.map((c) => canonico(c, plano, origem));
    const dentro = (c: Canto) => plano.sinal * (P[c.v * 3 + plano.eixo] - plano.valor) >= -eps;
    for (let k = 0; k < original.length; k++) {
      const a = original[k],
        b = original[(k + 1) % original.length],
        da = dentro(a),
        db = dentro(b);
      if (da) pol.push(a);
      if (da === db) continue;
      const den = P[b.v * 3 + plano.eixo] - P[a.v * 3 + plano.eixo];
      if (Math.abs(den) <= eps * eps) continue;
      const f = Math.max(0, Math.min(1, (plano.valor - P[a.v * 3 + plano.eixo]) / den));
      const pos = ponto(a.v).map((x, e) => x + (P[b.v * 3 + e] - x) * f) as V3;
      pos[plano.eixo] = plano.valor;
      let v = acharNoPlano(plano, pos, origem);
      if (v == null) {
        v = adicionar(pos, misturarPesos(pesos(a.v), pesos(b.v), f));
        registrarNoPlano(plano, pos, origem, v);
      }
      pol.push({
        v,
        uv: [a.uv[0] + (b.uv[0] - a.uv[0]) * f, a.uv[1] + (b.uv[1] - a.uv[1]) * f],
      });
    }
    return pol.filter((c, i) => c.v !== pol[(i + pol.length - 1) % pol.length].v);
  }
  for (const [origem, A, offset] of [
    [0, corpo, 0],
    [1, busto, deslocamento],
  ] as const) {
    for (let t = 0; t < A.I.length / 3; t++) {
      let pol: Canto[] = [0, 1, 2].map((k) => ({
        v: A.I[t * 3 + k] + offset,
        uv: A.UV ? [A.UV[t * 6 + k * 2], A.UV[t * 6 + k * 2 + 1]] : [...ajuste.branco],
      }));
      if (origem === 0) {
        const centroY = pol.reduce((s, c) => s + P[c.v * 3 + 1], 0) / 3;
        const centroZ = pol.reduce((s, c) => s + P[c.v * 3 + 2], 0) / 3;
        const noBraco =
          Math.abs(centroZ) > ajuste.bracoCorpo * 0.7 && centroY > (ajuste.alturaMinBracos ?? ajuste.cinturaCorpo + 2);
        pol = cortar(pol, noBraco ? planosCorpo[centroZ < 0 ? 1 : 2] : planosCorpo[0], origem);
      } else if (!ajuste.preservarTriangulosBusto?.[t]) {
        for (const p of planosBusto) {
          pol = cortar(pol, p, origem);
          if (pol.length < 3) break;
        }
      }
      const cor = Array.from(A.C.subarray(t * 3, t * 3 + 3)) as V3;
      for (let k = 1; k + 1 < pol.length; k++) emitir(pol[0], pol[k], pol[k + 1], cor, origem, t);
    }
  }

  function extrair(origem: 0 | 1, plano: Plano) {
    const edges = new Map<string, { a: number; b: number; n: number; cores: V3[] }>();
    for (let t = 0; t < I.length / 3; t++) {
      if (origens[t] !== origem) continue;
      if (origem === 1 && ajuste.preservarTriangulosBusto?.[fontes[t]]) continue;
      for (let k = 0; k < 3; k++) {
        const a = I[t * 3 + k],
          b = I[t * 3 + ((k + 1) % 3)];
        const cintura = origem === 0 ? ajuste.cinturaCorpo : ajuste.cinturaBusto;
        const minimoBracos = ajuste.alturaMinBracos ?? cintura + 2;
        if (plano.eixo === 2 && (P[a * 3 + 1] <= minimoBracos || P[b * 3 + 1] <= minimoBracos)) continue;
        if (
          Math.abs(P[a * 3 + plano.eixo] - plano.valor) > eps * 2 ||
          Math.abs(P[b * 3 + plano.eixo] - plano.valor) > eps * 2
        )
          continue;
        const key = a < b ? `${a},${b}` : `${b},${a}`;
        const e = edges.get(key) ?? { a, b, n: 0, cores: [] };
        e.n++;
        e.cores.push(C.slice(t * 3, t * 3 + 3) as V3);
        edges.set(key, e);
      }
    }
    const viz = new Map<number, Set<number>>(),
      cores: V3[] = [];
    let naoManifold = 0;
    for (const e of edges.values()) {
      if (e.n > 2) naoManifold++;
      if (e.n !== 1) continue;
      for (const [x, y] of [
        [e.a, e.b],
        [e.b, e.a],
      ]) {
        const l = viz.get(x) ?? new Set<number>();
        l.add(y);
        viz.set(x, l);
      }
      cores.push(...e.cores);
    }
    const vistos = new Set<number>(),
      grupos: number[][] = [];
    for (const inicio of viz.keys()) {
      if (vistos.has(inicio)) continue;
      const grupo: number[] = [],
        fila = [inicio];
      while (fila.length) {
        const v = fila.pop()!;
        if (vistos.has(v)) continue;
        vistos.add(v);
        grupo.push(v);
        for (const n of viz.get(v)!) fila.push(n);
      }
      grupos.push(grupo);
    }
    const verticesAbertos = [...viz.values()].filter((v) => v.size !== 2).length;
    const min: V3 = [Infinity, Infinity, Infinity],
      max: V3 = [-Infinity, -Infinity, -Infinity];
    for (const v of viz.keys())
      for (let e = 0; e < 3; e++) {
        min[e] = Math.min(min[e], P[v * 3 + e]);
        max[e] = Math.max(max[e], P[v * 3 + e]);
      }
    relatorio.contornos.push({
      nome: plano.nome,
      origem: origem === 0 ? "corpo" : "busto",
      eixo: plano.eixo,
      plano: plano.valor,
      arestas: [...edges.values()].filter((e) => e.n === 1).length,
      componentes: grupos.length,
      verticesAbertos,
      verticesNaoManifold: naoManifold,
      pontos: viz.size,
      caixa: viz.size ? { min, max } : null,
      extremos: [...viz].filter(([, ns]) => ns.size !== 2).map(([v, ns]) => ({ p: ponto(v), grau: ns.size })),
    });
    if (grupos.length !== 1 || verticesAbertos || naoManifold || (grupos[0]?.length ?? 0) < 3)
      falhar(
        `${origem === 0 ? "Corpo" : "Busto"}, ${plano.nome}: esperado um contorno fechado; encontrados ${grupos.length} componentes, ${verticesAbertos} vértices abertos e ${naoManifold} arestas não manifold.`,
      );
    const [e0, e1] = plano.eixo === 1 ? [0, 2] : [0, 1];
    const inicio = grupos[0].reduce((a, b) => (P[a * 3 + e0] > P[b * 3 + e0] ? a : b));
    const ordem = [inicio];
    let anterior = -1,
      atual = inicio;
    while (ordem.length < grupos[0].length) {
      const proximo =
        [...viz.get(atual)!].find((v) => v !== anterior && v !== inicio) ??
        falhar(`${plano.nome}: o contorno não pôde ser ordenado.`);
      ordem.push(proximo);
      anterior = atual;
      atual = proximo;
    }
    if (!viz.get(atual)!.has(inicio)) falhar(`${plano.nome}: percurso do contorno não fechou.`);
    let area = 0;
    for (let i = 0; i < ordem.length; i++) {
      const a = ordem[i],
        b = ordem[(i + 1) % ordem.length];
      area += P[a * 3 + e0] * P[b * 3 + e1] - P[b * 3 + e0] * P[a * 3 + e1];
    }
    if (Math.abs(area) <= eps * eps) falhar(`${plano.nome}: contorno sem área.`);
    if (area < 0) ordem.splice(1, ordem.length - 1, ...ordem.slice(1).reverse());
    const cor: V3 = [0, 1, 2].map((e) => cores.reduce((s, c) => s + c[e], 0) / Math.max(1, cores.length)) as V3;
    return { loop: ordem, cor };
  }
  const pares = planosCorpo.map((p, i) => ({
    planoA: p,
    planoB: planosBusto[i],
    a: extrair(0, p),
    b: extrair(1, planosBusto[i]),
  }));
  function perfil(loop: number[]) {
    const acum = [0];
    for (let i = 0; i < loop.length; i++) acum.push(acum[i] + distancia(loop[i], loop[(i + 1) % loop.length]));
    const total = acum[acum.length - 1];
    if (!(total > eps)) falhar("Contorno sem perímetro.");
    return acum.map((v) => v / total);
  }
  function amostrar(loop: number[], acum: number[], f: number) {
    let i = 0;
    while (i + 1 < loop.length && acum[i + 1] < f) i++;
    const a = loop[i],
      b = loop[(i + 1) % loop.length],
      w = (f - acum[i]) / Math.max(1e-12, acum[i + 1] - acum[i]);
    return {
      p: ponto(a).map((x, e) => x + (P[b * 3 + e] - x) * w) as V3,
      pesos: misturarPesos(pesos(a), pesos(b), w),
    };
  }
  function alinharFases(a: number[], b: number[], eixo: number) {
    const eixos = [0, 1, 2].filter((e) => e !== eixo);
    const candidatos = (loop: number[]) => {
      const n = Math.min(96, loop.length),
        escolhas = Array.from({ length: n }, (_, i) => Math.floor((i * loop.length) / n));
      const min = eixos.map((e) => Math.min(...loop.map((v) => P[v * 3 + e]))),
        max = eixos.map((e) => Math.max(...loop.map((v) => P[v * 3 + e])));
      const centro = min.map((x, e) => (x + max[e]) / 2),
        escala = Math.hypot(max[0] - min[0], max[1] - min[1]) || 1;
      return escolhas.map((inicio) => {
        const ordem = [...loop.slice(inicio), ...loop.slice(0, inicio)],
          acum = perfil(ordem),
          pontos: number[] = [];
        for (let i = 0; i < 24; i++) {
          const p = amostrar(ordem, acum, i / 24).p;
          for (let e = 0; e < 2; e++) pontos.push((p[eixos[e]] - centro[e]) / escala);
        }
        return { ordem, pontos };
      });
    };
    const ca = candidatos(a),
      cb = candidatos(b);
    let melhor = Infinity,
      ia = 0,
      ib = 0;
    for (let i = 0; i < ca.length; i++)
      for (let j = 0; j < cb.length; j++) {
        let erro = 0;
        for (let k = 0; k < ca[i].pontos.length; k++) erro += (ca[i].pontos[k] - cb[j].pontos[k]) ** 2;
        if (erro < melhor - 1e-12) {
          melhor = erro;
          ia = i;
          ib = j;
        }
      }
    return [ca[ia].ordem, cb[ib].ordem];
  }
  const N = Math.max(8, Math.min(128, Math.round(ajuste.amostrasAnel ?? 40)));
  for (const par of pares) {
    const { eixo } = par.planoA,
      [la, lb] = alinharFases(par.a.loop, par.b.loop, eixo),
      pa = perfil(la),
      pb = perfil(lb),
      aneis = [la];
    const passos = Math.max(3, Math.min(16, Math.ceil(Math.abs(par.planoB.valor - par.planoA.valor) / 0.65)));
    for (let passo = 1; passo < passos; passo++) {
      const t = passo / passos;
      const anel: number[] = [],
        f = t * t * (3 - 2 * t);
      for (let i = 0; i < N; i++) {
        const a = amostrar(la, pa, i / N),
          b = amostrar(lb, pb, i / N);
        const p = a.p.map((v, e) => v + (b.p[e] - v) * (e === eixo ? t : f)) as V3;
        anel.push(adicionar(p, misturarPesos(a.pesos, b.pesos, t)));
      }
      aneis.push(anel);
    }
    aneis.push(lb);
    const centroA = [0, 1, 2].map((e) => la.reduce((s, v) => s + P[v * 3 + e], 0) / la.length) as V3;
    const centroB = [0, 1, 2].map((e) => lb.reduce((s, v) => s + P[v * 3 + e], 0) / lb.length) as V3;
    const corA = par.a.cor,
      corB = ajuste.corBusto ?? corA;
    for (let anel = 0; anel + 1 < aneis.length; anel++) {
      const a = aneis[anel],
        b = aneis[anel + 1],
        fa = perfil(a),
        fb = perfil(b);
      let i = 0,
        j = 0;
      while (i < a.length || j < b.length) {
        let tri: number[];
        if (j >= b.length || (i < a.length && fa[i + 1] <= fb[j + 1])) {
          tri = [a[i % a.length], a[(i + 1) % a.length], b[j % b.length]];
          i++;
        } else {
          tri = [a[i % a.length], b[(j + 1) % b.length], b[j % b.length]];
          j++;
        }
        const ps = tri.map(ponto),
          centro = [0, 1, 2].map((e) => ps.reduce((s, p) => s + p[e], 0) / 3) as V3;
        const t = Math.max(0, Math.min(1, (centro[eixo] - par.planoA.valor) / (par.planoB.valor - par.planoA.valor)));
        const linha = centroA.map((x, e) => x + (centroB[e] - x) * t),
          u = ps[1].map((x, e) => x - ps[0][e]),
          v = ps[2].map((x, e) => x - ps[0][e]);
        const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        const radial = normal.reduce((s, n, e) => s + (e === eixo ? 0 : n * (centro[e] - linha[e])), 0);
        if (radial < 0) tri.reverse();
        const cor = corA.map((x, e) => x + (corB[e] - x) * t) as V3;
        if (
          !emitir(
            { v: tri[0], uv: ajuste.branco },
            { v: tri[1], uv: ajuste.branco },
            { v: tri[2], uv: ajuste.branco },
            cor,
            2,
            -1,
          )
        )
          falhar(`${par.planoA.nome}: triângulo degenerado na ponte.`);
      }
    }
  }

  // Compacta vértices referenciados, inclusive os gerados nos cortes; os originais removidos não gastam o limite Uint16.
  const remap = new Map<number, number>(),
    pFinal: number[] = [],
    jFinal: number[] = [],
    wFinal: number[] = [];
  for (let k = 0; k < I.length; k++) {
    const v = I[k];
    let n = remap.get(v);
    if (n == null) {
      n = remap.size;
      remap.set(v, n);
      pFinal.push(...ponto(v));
      jFinal.push(...J.slice(v * 4, v * 4 + 4));
      wFinal.push(...W.slice(v * 4, v * 4 + 4));
    }
    I[k] = n;
  }
  const nv = remap.size;
  if (nv > 65535) falhar(`União excedeu o limite Uint16: ${nv} vértices.`);
  const indices = Uint16Array.from(I),
    ini = new Uint32Array(nv + 1);
  for (const v of indices) ini[v + 1]++;
  for (let v = 0; v < nv; v++) ini[v + 1] += ini[v];
  const cantos = new Uint32Array(indices.length),
    pos = ini.slice(0, nv);
  for (let k = 0; k < indices.length; k++) cantos[pos[indices[k]]++] = k;
  const malha: Anim = {
    ...corpo,
    P: Float32Array.from(pFinal),
    J: Uint8Array.from(jFinal),
    W: Float32Array.from(wFinal),
    I: indices,
    C: Float32Array.from(C),
    UV: temUV ? Float32Array.from(UV) : undefined,
    tex: corpo.tex ?? busto.tex,
    ini,
    cantos,
  };
  relatorio.vertices = nv;
  relatorio.triangulos = indices.length / 3;
  return {
    malha,
    relatorio,
    origemTriangulos: Uint8Array.from(origens),
    triangulosFonte: Int32Array.from(fontes),
  };
}
