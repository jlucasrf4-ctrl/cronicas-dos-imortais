/* ==== v7.7 — leitura de FBX binário (Mixamo): esqueleto e animações ====
   Usado por tools/gerar-animacoes.ts para trazer animações do Mixamo para o esqueleto do Tripo (retarget por nome
   de osso). Lê a árvore de nós do FBX binário (versões 7.x; arrays com zlib), os ossos (Model "LimbNode"/"Null"),
   as propriedades de repouso (Lcl Translation/Rotation, PreRotation, PostRotation, RotationOrder) e as curvas de
   animação (AnimationCurveNode T/R/S → AnimationCurve, KeyTime em ticks de 1/46186158000 s). */
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

type Prop = number | bigint | string | boolean | number[] | bigint[] | Buffer;
export interface NoFbx {
  nome: string;
  props: Prop[];
  filhos: NoFbx[];
}

export function lerArvore(buf: Buffer): NoFbx[] {
  if (buf.toString("ascii", 0, 18) !== "Kaydara FBX Binary") throw new Error("não é FBX binário");
  const versao = buf.readUInt32LE(23),
    largo = versao >= 7500;
  let o = 27;
  const u = () => {
    const v = largo ? Number(buf.readBigUInt64LE(o)) : buf.readUInt32LE(o);
    o += largo ? 8 : 4;
    return v;
  };
  const prop = (): Prop => {
    const t = String.fromCharCode(buf[o++]);
    const arr = (tam: number, ler: (b: Buffer, i: number) => number | bigint) => {
      const n = buf.readUInt32LE(o),
        enc = buf.readUInt32LE(o + 4),
        len = buf.readUInt32LE(o + 8);
      o += 12;
      let dados = buf.subarray(o, o + len);
      o += len;
      if (enc === 1) dados = inflateSync(dados);
      const out: (number | bigint)[] = [];
      for (let i = 0; i < n; i++) out.push(ler(dados, i * tam));
      return out;
    };
    switch (t) {
      case "Y":
        return ((o += 2), buf.readInt16LE(o - 2));
      case "C":
        return ((o += 1), !!buf[o - 1]);
      case "I":
        return ((o += 4), buf.readInt32LE(o - 4));
      case "F":
        return ((o += 4), buf.readFloatLE(o - 4));
      case "D":
        return ((o += 8), buf.readDoubleLE(o - 8));
      case "L":
        return ((o += 8), buf.readBigInt64LE(o - 8));
      case "f":
        return arr(4, (b, i) => b.readFloatLE(i)) as number[];
      case "d":
        return arr(8, (b, i) => b.readDoubleLE(i)) as number[];
      case "l":
        return arr(8, (b, i) => b.readBigInt64LE(i)) as bigint[];
      case "i":
        return arr(4, (b, i) => b.readInt32LE(i)) as number[];
      case "b":
        return arr(1, (b, i) => b[i]) as number[];
      case "S": {
        const n = buf.readUInt32LE(o);
        o += 4;
        const s = buf.toString("utf8", o, o + n);
        o += n;
        return s;
      }
      case "R": {
        const n = buf.readUInt32LE(o);
        o += 4;
        const r = buf.subarray(o, o + n);
        o += n;
        return r;
      }
    }
    throw new Error("tipo de propriedade FBX desconhecido: " + t);
  };
  const no = (): NoFbx | null => {
    const fim = u(),
      np = u();
    u(); // tamanho da lista de propriedades
    const nl = buf[o++];
    if (fim === 0) return null;
    const nome = buf.toString("ascii", o, o + nl);
    o += nl;
    const props: Prop[] = [];
    for (let i = 0; i < np; i++) props.push(prop());
    const filhos: NoFbx[] = [];
    while (o < fim) {
      const f = no();
      if (!f) break;
      filhos.push(f);
    }
    o = fim;
    return { nome, props, filhos };
  };
  const raiz: NoFbx[] = [];
  while (o < buf.length - 160) {
    const n = no();
    if (!n) break;
    raiz.push(n);
  }
  return raiz;
}

/** Um osso do FBX: nome (sem "mixamorig:"), pai, repouso local (cm, graus) e curvas por quadro. */
export interface OssoFbx {
  id: bigint;
  nome: string;
  pai: number; // índice no array de ossos, -1 = raiz
  t: number[];
  r: number[];
  pre: number[];
  post: number[];
  ordem: number; // RotationOrder (0 = XYZ)
  curvas: Partial<Record<"T" | "R" | "S", { t: number[]; v: number[][] }>>; // tempos (s) e valores x,y,z
}
export interface Fbx {
  ossos: OssoFbx[];
  duracao: number;
  /** cm por unidade do arquivo (UnitScaleFactor) */
  unidade: number;
}

const TICKS = 46186158000;

export function lerFbx(arquivo: string | Buffer): Fbx {
  const arv = lerArvore(typeof arquivo === "string" ? readFileSync(arquivo) : arquivo);
  const sec = (n: string) => arv.find((x) => x.nome === n);
  const objs = sec("Objects")?.filhos ?? [];
  const conns = (sec("Connections")?.filhos ?? []).map((c) => c.props);
  const p70 = (n: NoFbx) => {
    const m = new Map<string, Prop[]>();
    for (const p of n.filhos.find((x) => x.nome === "Properties70")?.filhos ?? [])
      m.set(String(p.props[0]), p.props.slice(4));
    return m;
  };
  let unidade = 1;
  for (const p of sec("GlobalSettings")?.filhos.find((x) => x.nome === "Properties70")?.filhos ?? [])
    if (p.props[0] === "UnitScaleFactor") unidade = Number(p.props[4]);
  const modelos = objs.filter(
    (n) => n.nome === "Model" && (n.props[2] === "LimbNode" || n.props[2] === "Null" || n.props[2] === "Root"),
  );
  const ossos: OssoFbx[] = modelos.map((n) => {
    const P = p70(n),
      v3 = (k: string, pad = [0, 0, 0]) => (P.get(k) ?? pad).map(Number);
    return {
      id: n.props[0] as bigint,
      nome: String(n.props[1])
        .split("\u0000")[0]
        .replace(/^mixamorig\d*:/, ""),
      pai: -1,
      t: v3("Lcl Translation"),
      r: v3("Lcl Rotation"),
      pre: v3("PreRotation"),
      post: v3("PostRotation"),
      ordem: Number((P.get("RotationOrder") ?? [0])[0]),
      curvas: {},
    };
  });
  const porId = new Map(ossos.map((b, i) => [b.id, i]));
  // hierarquia: conexões "OO" filho → pai
  for (const c of conns)
    if (c[0] === "OO" && porId.has(c[1] as bigint) && porId.has(c[2] as bigint))
      ossos[porId.get(c[1] as bigint)!].pai = porId.get(c[2] as bigint)!;
  // curvas: AnimationCurve → AnimationCurveNode ("d|X") → Model ("Lcl Translation" …)
  const curvas = new Map<bigint, { t: number[]; v: number[] }>();
  for (const n of objs)
    if (n.nome === "AnimationCurve") {
      const kt = n.filhos.find((x) => x.nome === "KeyTime")?.props[0] as bigint[] | undefined,
        kv = n.filhos.find((x) => x.nome === "KeyValueFloat")?.props[0] as number[] | undefined;
      if (kt && kv) curvas.set(n.props[0] as bigint, { t: kt.map((x) => Number(x) / TICKS), v: kv.map(Number) });
    }
  const nosCurva = new Map<
    bigint,
    { tipo: "T" | "R" | "S"; eixos: ({ t: number[]; v: number[] } | null)[]; osso: number }
  >();
  for (const n of objs)
    if (n.nome === "AnimationCurveNode") {
      const tipo = String(n.props[1]).split("\u0000")[0];
      if (tipo === "T" || tipo === "R" || tipo === "S")
        nosCurva.set(n.props[0] as bigint, { tipo, eixos: [null, null, null], osso: -1 });
    }
  for (const c of conns) {
    if (c[0] !== "OP") continue;
    const a = c[1] as bigint,
      b = c[2] as bigint,
      nome = String(c[3]);
    if (curvas.has(a) && nosCurva.has(b)) {
      const i = { "d|X": 0, "d|Y": 1, "d|Z": 2 }[nome];
      if (i != null) nosCurva.get(b)!.eixos[i] = curvas.get(a)!;
    } else if (nosCurva.has(a) && porId.has(b)) nosCurva.get(a)!.osso = porId.get(b)!;
  }
  let duracao = 0;
  for (const nc of nosCurva.values()) {
    if (nc.osso < 0) continue;
    const ref = nc.eixos.find(Boolean);
    if (!ref) continue;
    const osso = ossos[nc.osso],
      pad = nc.tipo === "T" ? osso.t : nc.tipo === "R" ? osso.r : [1, 1, 1];
    const v = ref.t.map((tt, k) =>
      [0, 1, 2].map((e) => (nc.eixos[e] ? nc.eixos[e]!.v[Math.min(k, nc.eixos[e]!.v.length - 1)] : pad[e])),
    );
    osso.curvas[nc.tipo] = { t: ref.t, v };
    duracao = Math.max(duracao, ref.t[ref.t.length - 1]);
  }
  return { ossos, duracao, unidade };
}

/** v7.7 — malha com pele de um FBX (os animais do pacote craftpix): pontos de controle, polígonos com UV por canto,
 *  ossos (nome, pai) e, por osso, os vértices/pesos e as matrizes de bind (globais, como o FBX guarda). */
export interface MalhaFbx {
  P: number[]; // pontos de controle (espaço da malha)
  poli: number[][]; // índices dos pontos de cada polígono
  uv: number[][][]; // UV de cada canto de cada polígono
  ossos: { nome: string; pai: number; idx: number[]; peso: number[]; link: number[]; malha: number[] }[];
  /** global da malha na BindPose (null se o FBX não tiver) */
  bindMalha: number[] | null;
}

export function lerMalhaFbx(buf: Buffer): MalhaFbx {
  const arv = lerArvore(buf);
  const objs = arv.find((x) => x.nome === "Objects")?.filhos ?? [];
  const conns = (arv.find((x) => x.nome === "Connections")?.filhos ?? []).map((c) => c.props);
  const filho = (n: NoFbx, nome: string) => n.filhos.find((x) => x.nome === nome);
  const geo = objs.find((n) => n.nome === "Geometry");
  if (!geo) throw new Error("FBX sem malha");
  const P = (filho(geo, "Vertices")!.props[0] as number[]).map(Number);
  const PVI = filho(geo, "PolygonVertexIndex")!.props[0] as number[];
  const camUV = filho(geo, "LayerElementUV")!;
  const UV = filho(camUV, "UV")!.props[0] as number[],
    UVI = filho(camUV, "UVIndex")?.props[0] as number[] | undefined;
  const poli: number[][] = [],
    uv: number[][][] = [];
  let atual: number[] = [],
    atualUV: number[][] = [];
  PVI.forEach((v, k) => {
    const fim = v < 0,
      i = fim ? -v - 1 : v,
      u = UVI ? UVI[k] : k;
    atual.push(i);
    atualUV.push([UV[u * 2], UV[u * 2 + 1]]);
    if (fim) {
      poli.push(atual);
      uv.push(atualUV);
      atual = [];
      atualUV = [];
    }
  });
  const limbs = objs.filter((n) => n.nome === "Model" && n.props[2] === "LimbNode");
  const porId = new Map(limbs.map((n, i) => [n.props[0] as bigint, i]));
  const ossos = limbs.map((n) => ({
    nome: String(n.props[1]).split("\u0000")[0],
    pai: -1,
    idx: [] as number[],
    peso: [] as number[],
    link: [] as number[],
    malha: [] as number[],
  }));
  for (const c of conns)
    if (c[0] === "OO" && porId.has(c[1] as bigint) && porId.has(c[2] as bigint))
      ossos[porId.get(c[1] as bigint)!].pai = porId.get(c[2] as bigint)!;
  // cluster → osso: a conexão "OO" (osso, cluster)
  const clusters = new Map(
    objs.filter((n) => n.nome === "Deformer" && n.props[2] === "Cluster").map((n) => [n.props[0] as bigint, n]),
  );
  for (const c of conns) {
    if (c[0] !== "OO" || !porId.has(c[1] as bigint) || !clusters.has(c[2] as bigint)) continue;
    const cl = clusters.get(c[2] as bigint)!,
      o = ossos[porId.get(c[1] as bigint)!];
    o.idx = ((filho(cl, "Indexes")?.props[0] as number[]) ?? []).map(Number);
    o.peso = ((filho(cl, "Weights")?.props[0] as number[]) ?? []).map(Number);
    o.link = (filho(cl, "TransformLink")!.props[0] as number[]).map(Number);
    o.malha = (filho(cl, "Transform")!.props[0] as number[]).map(Number);
  }
  const idMalha = objs.find((n) => n.nome === "Model" && n.props[2] === "Mesh")?.props[0];
  let bindMalha: number[] | null = null;
  for (const pose of objs.filter((n) => n.nome === "Pose"))
    for (const pn of pose.filhos.filter((x) => x.nome === "PoseNode"))
      if (filho(pn, "Node")?.props[0] === idMalha) bindMalha = (filho(pn, "Matrix")!.props[0] as number[]).map(Number);
  return { P, poli, uv, ossos, bindMalha };
}

/** Quatérnio [x,y,z,w] de ângulos de Euler em graus, na ordem de rotação do FBX (0 = XYZ: aplica X, depois Y, depois Z). */
export function quatEuler(g: number[], ordem = 0): number[] {
  const q = (eixo: number, a: number) => {
    const h = (a * Math.PI) / 360,
      r = [0, 0, 0, Math.cos(h)];
    r[eixo] = Math.sin(h);
    return r;
  };
  const mul = (a: number[], b: number[]) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
  const ordens = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 2, 0],
    [1, 0, 2],
    [2, 0, 1],
    [2, 1, 0],
  ][ordem] ?? [0, 1, 2];
  // aplica o 1º eixo primeiro: R = R3 · R2 · R1
  return mul(mul(q(ordens[2], g[ordens[2]]), q(ordens[1], g[ordens[1]])), q(ordens[0], g[ordens[0]]));
}

/** Valor de uma curva no tempo t (linear entre as chaves). */
export function amostrarCurva(c: { t: number[]; v: number[][] }, t: number) {
  const T = c.t;
  if (t <= T[0]) return c.v[0];
  if (t >= T[T.length - 1]) return c.v[c.v.length - 1];
  let k = 0;
  while (T[k + 1] < t) k++;
  const f = (t - T[k]) / (T[k + 1] - T[k] || 1);
  return c.v[k].map((x, i) => x + (c.v[k + 1][i] - x) * f);
}
