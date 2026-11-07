/** Ajusta só a faixa superior da calça já reduzida, sem acrescentar triângulos. */
import type { Anim, DadosAnim } from "../../src/render/gl/esqueleto.ts";

export interface AjusteCos {
  de: number;
  ate: number;
  folga: number;
  pecas: number[];
}
type Ponto = { x: number; z: number; pesos: Map<number, number> };
const cruz = (a: number[], b: number[]) => a[0] * b[1] - a[1] * b[0];
const misturar = (a: Map<number, number>, b: Map<number, number>, f: number) => {
  const s = new Map<number, number>();
  for (const [j, w] of a) s.set(j, w * (1 - f));
  for (const [j, w] of b) s.set(j, (s.get(j) ?? 0) + w * f);
  return s;
};

export function ajustarCos(
  camada: DadosAnim,
  corpo: Anim,
  config: AjusteCos,
  verticesCalca: Set<string>,
  chao: number,
  altura: number,
): DadosAnim {
  const ler = (s: string) => Uint8Array.from(Buffer.from(s, "base64")).buffer;
  const P = new Int16Array(ler(camada.malha.p));
  const I = new Uint16Array(ler(camada.malha.i));
  const J = new Uint8Array(ler(camada.malha.j));
  const W = new Uint8Array(ler(camada.malha.w));
  const chave = (v: number) => `${P[v * 3]},${P[v * 3 + 1]},${P[v * 3 + 2]}`;
  const eCalca = Array.from({ length: P.length / 3 }, (_, v) => verticesCalca.has(chave(v)));
  const inicio = chao + altura * config.de;
  const topo = chao + altura * config.ate;
  if (!(config.de < config.ate && config.folga > 0)) throw new Error("Faixa do cós inválida");
  const arestas = new Map<string, { a: number; b: number; n: number }>();
  for (let t = 0; t < I.length; t += 3) {
    if (![0, 1, 2].every((k) => eCalca[I[t + k]])) continue;
    for (let k = 0; k < 3; k++) {
      const a = I[t + k],
        b = I[t + ((k + 1) % 3)];
      const chave = a < b ? `${a},${b}` : `${b},${a}`;
      const e = arestas.get(chave);
      if (e) e.n++;
      else arestas.set(chave, { a, b, n: 1 });
    }
  }
  const adj = new Map<number, Set<number>>();
  for (const e of arestas.values()) if(e.n===1) for(const [a,b] of [[e.a,e.b],[e.b,e.a]]) {const l=adj.get(a)??new Set<number>();l.add(b);adj.set(a,l);}
  const visto=new Set<number>();const grupos:number[][]=[];
  for(const v of adj.keys()) {if(visto.has(v))continue;const fila=[v],g:number[]=[];visto.add(v);while(fila.length){const a=fila.pop()!;g.push(a);for(const b of adj.get(a)??[])if(!visto.has(b)){visto.add(b);fila.push(b);}}grupos.push(g);}
  // Ignora contornos de furos, bolsos e punhos; só a borda mais alta recebe a linha do cós.
  const principal = grupos.filter(g => g.length >= 6).sort((a,b) => Math.max(...b.map(v=>P[v*3+1])) - Math.max(...a.map(v=>P[v*3+1])))[0];
  const limiteBorda = Math.max(inicio, Math.max(...principal.map(v=>P[v*3+1]/64)) - altura * 0.04);
  const borda = new Set(principal.filter(v=>P[v*3+1]/64>limiteBorda));  if (borda.size < 6) throw new Error("A calça não tem borda superior identificável");
  const pesosCorpo = (v: number) => {
    const p = new Map<number, number>();
    for (let k = 0; k < 4; k++) if (corpo.W[v * 4 + k]) p.set(corpo.J[v * 4 + k], corpo.W[v * 4 + k]);
    return p;
  };
  const vertice = (v: number): Ponto => ({ x: corpo.P[v * 3], z: corpo.P[v * 3 + 2], pesos: pesosCorpo(v) });
  const interpolar = (a: Ponto, b: Ponto, f: number): Ponto => ({
    x: a.x + (b.x - a.x) * f,
    z: a.z + (b.z - a.z) * f,
    pesos: misturar(a.pesos, b.pesos, f),
  });
  const secao = (y: number) => {
    const segmentos: Ponto[][] = [];
    for (let t = 0; t < corpo.I.length; t += 3) {
      const pontos: Ponto[] = [];
      for (let k = 0; k < 3; k++) {
        const a = corpo.I[t + k],
          b = corpo.I[t + ((k + 1) % 3)];
        const ya = corpo.P[a * 3 + 1],
          yb = corpo.P[b * 3 + 1];
        if ((ya < y && yb >= y) || (yb < y && ya >= y))
          pontos.push(interpolar(vertice(a), vertice(b), (y - ya) / (yb - ya)));
      }
      if (pontos.length === 2) segmentos.push(pontos);
    }
    if (!segmentos.length) throw new Error(`Corpo sem seção de pelve em ${y}`);
    const pontos = segmentos.flat();
    const cx = (Math.min(...pontos.map((p) => p.x)) + Math.max(...pontos.map((p) => p.x))) / 2;
    const cz = (Math.min(...pontos.map((p) => p.z)) + Math.max(...pontos.map((p) => p.z))) / 2;
    return { segmentos, cx, cz };
  };
  const centro = secao(inicio);
  const angulo = (v: number) => Math.atan2(P[v * 3 + 2] / 64 - centro.cz, P[v * 3] / 64 - centro.cx);
  const bordas = [...borda].map((v) => ({ v, y: P[v * 3 + 1] / 64, angulo: angulo(v) }));
  const diferenca = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  // Usa as posições originais em toda a passagem: o resultado independe da ordem dos vértices.
  const original = P.slice();
  let inteiros=0,parciais=0;for(let t=0;t<I.length;t+=3)if([0,1,2].every(k=>eCalca[I[t+k]])){const ys=[0,1,2].map(k=>P[I[t+k]*3+1]/64);if(Math.min(...ys)>inicio)inteiros++;if(Math.max(...ys)>inicio)parciais++;}console.log("faixa",{inteiros,parciais,borda:borda.size});
  let ajustados = 0;
  for (let v = 0; v < P.length / 3; v++) {
    const y = original[v * 3 + 1] / 64;
    if (!eCalca[v] || y <= inicio) continue;
    const ang = angulo(v);
    const proxima = bordas.reduce((a, b) => (diferenca(a.angulo, ang) < diferenca(b.angulo, ang) ? a : b));
    const f0 = Math.max(0, Math.min(1, (y - inicio) / Math.max(0.1, proxima.y - inicio)));
    const f = borda.has(v) ? 1 : f0 * f0 * (3 - 2 * f0);
    const novoY = y + (topo - (borda.has(v) ? y : proxima.y)) * f;
    const s = secao(novoY);
    const direcao = [Math.cos(ang), Math.sin(ang)];
    let raio = -Infinity;
    let ponto: Ponto | undefined;
    for (const [a, b] of s.segmentos) {
      const d = [b.x - a.x, b.z - a.z],
        q = [a.x - s.cx, a.z - s.cz];
      const divisor = cruz(direcao, d);
      if (Math.abs(divisor) < 1e-9) continue;
      const r = cruz(q, d) / divisor,
        t = cruz(q, direcao) / divisor;
      if (r > raio && r >= 0 && t >= -1e-6 && t <= 1 + 1e-6) {
        raio = r;
        ponto = interpolar(a, b, Math.max(0, Math.min(1, t)));
      }
    }
    if (!ponto) throw new Error(`Cós sem contato com a pelve no vértice ${v}`);
    const destino = raio + config.folga * altura;
    const antigo = Math.hypot(original[v * 3] / 64 - s.cx, original[v * 3 + 2] / 64 - s.cz);
    const r = Math.max(destino, antigo + (destino - antigo) * f);
    P[v * 3] = Math.round((s.cx + direcao[0] * r) * 64);
    P[v * 3 + 1] = Math.round(novoY * 64);
    P[v * 3 + 2] = Math.round((s.cz + direcao[1] * r) * 64);
    const anteriores = new Map<number, number>();
    for (let k = 0; k < 4; k++) if (W[v * 4 + k]) anteriores.set(J[v * 4 + k], W[v * 4 + k] / 255);
    const pesos = [...misturar(anteriores, ponto.pesos, f)].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const soma = pesos.reduce((a, [, w]) => a + w, 0);
    const quantizados = pesos.map(([, w]) => Math.round((w / soma) * 255));
    quantizados[0] += 255 - quantizados.reduce((a, b) => a + b, 0);
    J.fill(0, v * 4, v * 4 + 4);
    W.fill(0, v * 4, v * 4 + 4);
    pesos.forEach(([j], k) => {
      J[v * 4 + k] = j;
      W[v * 4 + k] = quantizados[k];
    });
    ajustados++;
  }
  console.log(
    `cós: ${ajustados} vértices ajustados; faixa ${inicio.toFixed(3)}–${topo.toFixed(3)}; ${I.length / 3} triângulos preservados`,
  );
  const b64 = (v: ArrayBufferView) => Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString("base64");
  return { ...camada, malha: { ...camada.malha, p: b64(P), j: b64(J), w: b64(W) } };
}
