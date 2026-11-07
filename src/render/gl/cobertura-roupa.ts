/** Oculta somente os triângulos de pele cobertos pelas peças presentes, sem modificar a malha original. */
import { decodificarAnim, type Anim, type DadosAnim } from "./esqueleto.ts";
const REGISTROS = new WeakMap<DadosAnim, { id: number; faces: Set<string> }>();
const RESULTADOS = new WeakMap<Anim, Map<string, Anim>>();
const DECODIFICADOS = new WeakMap<DadosAnim, Anim>();
let proximoId = 1;
/** A assinatura usa os nove Int16 de posição, em ordem independente dos índices e dos cantos. */
export function assinaturaTriangulo(P: ArrayLike<number>, I: ArrayLike<number>, t: number, escala = 64) {
  return [0, 1, 2]
    .map((k) => [0, 1, 2].map((e) => Math.round(P[I[t * 3 + k] * 3 + e] * escala)).join(","))
    .sort()
    .join(";");
}
function registro(d: DadosAnim) {
  let r = REGISTROS.get(d);
  if (r) return r;
  const bin = atob(d.coberturaCorpo!),
    bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  if (bytes.length % 18) throw new Error("Cobertura de roupa inválida");
  const p = new Int16Array(bytes.buffer),
    faces = new Set<string>(),
    indices = [0, 1, 2];
  for (let i = 0; i < p.length; i += 9) faces.add(assinaturaTriangulo(p.subarray(i, i + 9), indices, 0, 1));
  r = { id: proximoId++, faces };
  REGISTROS.set(d, r);
  return r;
}
export function ocultarPeleCoberta(dados: Anim | DadosAnim | null, partes: readonly (DadosAnim | null | undefined)[]) {
  const coberturas = partes.filter((p): p is DadosAnim => !!p?.coberturaCorpo).map(registro);
  if (!dados || !coberturas.length) return dados;
  let A: Anim;
  if ("ini" in dados) A = dados;
  else {
    let anim = DECODIFICADOS.get(dados);
    if (!anim) DECODIFICADOS.set(dados, (anim = decodificarAnim(dados)));
    A = anim;
  }
  const chave = coberturas
    .map((c) => c.id)
    .sort((a, b) => a - b)
    .join("|");
  let cache = RESULTADOS.get(A);
  if (!cache) RESULTADOS.set(A, (cache = new Map()));
  const anterior = cache.get(chave);
  if (anterior) return anterior;
  const fica: number[] = [];
  for (let t = 0; t < A.I.length / 3; t++) {
    const assinatura = assinaturaTriangulo(A.P, A.I, t);
    if (!coberturas.some((c) => c.faces.has(assinatura))) fica.push(t);
  }
  if (fica.length === A.I.length / 3) {
    cache.set(chave, A);
    return A;
  }
  const I = Uint16Array.from(fica.flatMap((t) => Array.from(A.I.subarray(t * 3, t * 3 + 3))));
  const C = Float32Array.from(fica.flatMap((t) => Array.from(A.C.subarray(t * 3, t * 3 + 3))));
  const UV = A.UV && Float32Array.from(fica.flatMap((t) => Array.from(A.UV!.subarray(t * 6, t * 6 + 6))));
  const nv = A.P.length / 3,
    ini = new Uint32Array(nv + 1);
  for (const v of I) ini[v + 1]++;
  for (let v = 0; v < nv; v++) ini[v + 1] += ini[v];
  const cantos = new Uint32Array(I.length),
    pos = ini.slice(0, nv);
  for (let k = 0; k < I.length; k++) cantos[pos[I[k]]++] = k;
  const resultado = { ...A, I, C, UV, ini, cantos };
  cache.set(chave, resultado);
  return resultado;
}
