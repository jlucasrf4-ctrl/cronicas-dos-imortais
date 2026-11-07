/** Rotinas puras do busto integral. Copiar para tools/lib para resolver estes imports. */
import { Matrix4 } from "three";
import type { Anim, DadosAnim } from "../../src/render/gl/esqueleto.ts";

/** Conserva as orientações globais de bind e a malha; só muda as posições pedidas. */
export function reposicionarJuntas(dados: DadosAnim, alvos: Readonly<Record<string, readonly number[]>>): DadosAnim {
  const globais = dados.ibm.map((m) => {
    const matriz = new Matrix4().fromArray(m);
    if (Math.abs(matriz.determinant()) < 1e-15) throw new Error("Matriz de bind singular");
    return matriz.invert();
  });
  for (const [nome, posicao] of Object.entries(alvos)) {
    const j = dados.juntas.indexOf(nome);
    if (j < 0) throw new Error("Junta não encontrada: " + nome);
    if (posicao.length !== 3 || !posicao.every(Number.isFinite)) throw new Error("Posição inválida para " + nome);
    globais[j].elements[12] = posicao[0];
    globais[j].elements[13] = posicao[1];
    globais[j].elements[14] = posicao[2];
  }
  const inversaRaiz = new Matrix4().fromArray(dados.raiz).invert();
  const repouso = globais.map((g, j) => {
    const pai = dados.pais[j];
    const ip = pai < 0 ? inversaRaiz : globais[pai].clone().invert();
    const m = ip.elements, x = g.elements[12], y = g.elements[13], z = g.elements[14];
    return [m[0]*x + m[4]*y + m[8]*z + m[12], m[1]*x + m[5]*y + m[9]*z + m[13], m[2]*x + m[6]*y + m[10]*z + m[14]];
  });
  return { ...dados, repouso, ibm: globais.map((g) => g.clone().invert().toArray()) };
}

export interface MarcosPesosBusto {
  queixoY: number;
  /** Centro/base de atuação da junta Neck no busto já transformado para o jogo. */
  basePescocoY: number;
  eixoZ: number;
}
const suave = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x-a)/(b-a)));
  return t*t*(3-2*t);
};

/**
 * Transfere somente J/W. A geometria, índices e UVs ficam sob responsabilidade da montagem.
 * O cabelo marcado acompanha Head mesmo abaixo do queixo. Os anéis finais devem copiar os pesos
 * dos vértices correspondentes do corpo antigo para compartilhar exatamente a deformação.
 */
export function transferirPesosBusto(ref: Anim, Pnovos: ArrayLike<number>, marcos: MarcosPesosBusto, cabelo?: Uint8Array) {
  if (Pnovos.length % 3) throw new Error("Posições do busto incompletas");
  const nv = Pnovos.length/3, J = new Uint8Array(nv*4), W = new Float32Array(nv*4);
  const junta = (nome: string) => {
    const direto = ref.juntas.indexOf(nome);
    return direto >= 0 ? direto : ref.juntas.findIndex((n) => n.endsWith(":"+nome));
  };
  const head = junta("Head"), neck = junta("Neck"), spine2 = junta("Spine2");
  if (head < 0 || neck < 0 || spine2 < 0) throw new Error("Rig sem Head, Neck ou Spine2");
  const ehBraco = ref.juntas.map((n) => /(?:Arm|ForeArm|Hand)$/.test(n));
  const ehClavicula = ref.juntas.map((n) => /Shoulder$/.test(n));
  const ehCabeca = ref.juntas.map((_, j) => j === head || j === neck);
  let ymin = Infinity, ymax = -Infinity;
  for (let i=1; i<ref.P.length; i+=3) { ymin = Math.min(ymin, ref.P[i]); ymax = Math.max(ymax, ref.P[i]); }
  const cel = Math.max(.25, (ymax-ymin)/55), grade = new Map<string, number[]>();
  const pesoBraco = new Float32Array(ref.P.length/3), pesoCabeca = new Float32Array(ref.P.length/3);
  for (let v=0; v<ref.P.length/3; v++) {
    for (let k=0; k<4; k++) {
      if (ehBraco[ref.J[v*4+k]]) pesoBraco[v] += ref.W[v*4+k];
      if (ehCabeca[ref.J[v*4+k]]) pesoCabeca[v] += ref.W[v*4+k];
    }
    const chave = [0,1,2].map(e=>Math.floor(ref.P[v*3+e]/cel)).join(",");
    const lista = grade.get(chave) ?? []; lista.push(v); grade.set(chave, lista);
  }
  function normalizar(v: number, pesos: Map<number, number>) {
    const top = [...pesos].filter(([,w])=>w>1e-10).sort((a,b)=>b[1]-a[1]).slice(0,4);
    const soma = top.reduce((s,[,w])=>s+w,0);
    if (soma <= 0) { J[v*4] = spine2; W[v*4] = 1; return; }
    for (let k=0; k<4; k++) { J[v*4+k] = top[k]?.[0] ?? 0; W[v*4+k] = (top[k]?.[1] ?? 0)/soma; }
  }
  for (let v=0; v<nv; v++) {
    const p = [Pnovos[v*3], Pnovos[v*3+1], Pnovos[v*3+2]];
    if (!p.every(Number.isFinite)) throw new Error("Vértice inválido no busto: " + v);
    const [x,y,z] = p, lateral = Math.abs(z-marcos.eixoZ), sinal = Math.sign(z-marcos.eixoZ);
    if (cabelo?.[v] || y >= marcos.queixoY) { J[v*4] = head; W[v*4] = 1; continue; }
    const noBraco = lateral > 2.5 && y > marcos.basePescocoY-3.3;
    const aceita = (u: number) => {
      const ladoRef = Math.sign(ref.P[u*3+2]-marcos.eixoZ);
      if (pesoBraco[u] > .15 && ladoRef && sinal && ladoRef !== sinal) return false;
      if (lateral <= 2.5 && pesoBraco[u] > .1) return false;
      if (!noBraco && pesoBraco[u] > .5) return false;
      if (y < marcos.basePescocoY-.8 && pesoCabeca[u] > .5) return false;
      return true;
    };
    const g = p.map(c=>Math.floor(c/cel));
    let candidatos: { u: number; d: number }[] = [];
    for (let raio=1; raio<=10; raio++) {
      candidatos = [];
      for (let a=-raio; a<=raio; a++) for (let b=-raio; b<=raio; b++) for (let c=-raio; c<=raio; c++) {
        for (const u of grade.get([g[0]+a,g[1]+b,g[2]+c].join(",")) ?? []) {
          if (!aceita(u)) continue;
          const d = (ref.P[u*3]-x)**2 + (ref.P[u*3+1]-y)**2 + (ref.P[u*3+2]-z)**2;
          candidatos.push({u,d});
        }
      }
      if (candidatos.length >= 6) break;
    }
    // Fallback anatômico global: não mistura o braço oposto só por faltar amostra local.
    if (!candidatos.length) for (let u=0; u<ref.P.length/3; u++) if (aceita(u)) {
      candidatos.push({u,d:(ref.P[u*3]-x)**2+(ref.P[u*3+1]-y)**2+(ref.P[u*3+2]-z)**2});
    }
    candidatos.sort((a,b)=>a.d-b.d);
    const pesos = new Map<number,number>();
    for (const {u,d} of candidatos.slice(0,6)) {
      const f = 1/(Math.sqrt(d)+cel*.1);
      for (let k=0; k<4; k++) {
        const j = ref.J[u*4+k];
        if (lateral <= 2.5 && ehBraco[j]) continue;
        if (y < marcos.basePescocoY-.8 && ehCabeca[j]) continue;
        pesos.set(j,(pesos.get(j)??0)+ref.W[u*4+k]*f);
      }
    }
    let soma = [...pesos.values()].reduce((a,b)=>a+b,0);
    if (soma <= 0) { pesos.set(spine2,1); soma=1; }
    for (const [j,w] of pesos) pesos.set(j,w/soma);
    // O deltoide entra aos poucos; o peito central não herda Arm por proximidade.
    const fBraco = suave(2.5,4.5,lateral);
    const fClavicula = noBraco ? 1 : suave(marcos.basePescocoY-2.6,marcos.basePescocoY-1.2,y)*suave(.75,2.5,lateral);
    let voltaTorax = 0;
    for (const [j,w] of pesos) if (ehBraco[j]) { const novo=w*fBraco; voltaTorax+=w-novo; pesos.set(j,novo); }
    for (const [j,w] of pesos) if (ehClavicula[j]) { const novo=w*fClavicula; voltaTorax+=w-novo; pesos.set(j,novo); }
    pesos.set(spine2,(pesos.get(spine2)??0)+voltaTorax);
    const centro = 1-suave(.9,2.5,lateral);
    const entraNeck = suave(marcos.basePescocoY-.8,marcos.basePescocoY+.15,y)*centro;
    if (entraNeck > 0) {
      const fh = suave(marcos.basePescocoY+.25,marcos.queixoY,y);
      for (const [j,w] of pesos) pesos.set(j,w*(1-entraNeck));
      pesos.set(neck,(pesos.get(neck)??0)+entraNeck*(1-fh));
      pesos.set(head,(pesos.get(head)??0)+entraNeck*fh);
    }
    normalizar(v,pesos);
  }
  return { J, W };
}
