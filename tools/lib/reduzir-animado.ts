/* v8.1 — reduz uma peça animada mantendo esqueleto, pesos e textura projetada da superfície original. */
import sharp from "sharp";
import { reduzirPecaUV } from "./peca.ts";
import type { DadosAnim } from "../../src/render/gl/esqueleto.ts";
const b64 = (v: ArrayBufferView) => Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString("base64");
export async function reduzirAnimado(d: DadosAnim, alvo: number): Promise<DadosAnim> {
  const bytes = (s: string) => Uint8Array.from(Buffer.from(s, "base64")).buffer;
  const P = new Int16Array(bytes(d.malha.p)),
    I = new Uint16Array(bytes(d.malha.i));
  if (I.length / 3 <= alvo) return d;
  const J = new Uint8Array(bytes(d.malha.j)),
    W = new Uint8Array(bytes(d.malha.w)),
    C = new Uint8Array(bytes(d.malha.c));
  const UV = d.malha.uv ? new Uint16Array(bytes(d.malha.uv)) : null;
  const pp = new Float32Array(I.length * 3),
    tt = new Float32Array(I.length * 2);
  // A metade superior guarda a imagem; a inferior guarda uma paleta fixa para as faces de cor lisa.
  // Essas faces apontavam para branco e eram multiplicadas por C: ignorar C as deixaria brancas.
  const temImagem = !!(d.tex && UV),
    lado = temImagem ? 1024 : 256;
  const tex = Buffer.alloc(lado * lado * 3, 255);
  let imagemSaida = d.tex;
  if (temImagem) {
    tex.set(
      await sharp(Buffer.from(d.tex!.split(",")[1], "base64"))
        .resize(1024, 512, { fit: "fill" })
        .removeAlpha()
        .raw()
        .toBuffer(),
    );
    for (let id = 0; id < 32768; id++) {
      const p = ((512 + Math.floor(id / 256)) * 1024 + (id % 256)) * 3;
      tex[p] = Math.round(((id >> 10) * 255) / 31);
      tex[p + 1] = Math.round((((id >> 5) & 31) * 255) / 31);
      tex[p + 2] = Math.round(((id & 31) * 255) / 31);
    }
  } else tex.set(C);
  const porPosicao = new Map<string, number>();
  for (let v = 0; v < P.length / 3; v++) porPosicao.set(`${P[v * 3]},${P[v * 3 + 1]},${P[v * 3 + 2]}`, v);
  for (let k = 0; k < I.length; k++) {
    const t = Math.floor(k / 3);
    for (let e = 0; e < 3; e++) pp[k * 3 + e] = P[I[k] * 3 + e] / 64;
    const lisa = C[t * 3] !== 255 || C[t * 3 + 1] !== 255 || C[t * 3 + 2] !== 255;
    const id =
      Math.round((C[t * 3] / 255) * 31) * 1024 +
      Math.round((C[t * 3 + 1] / 255) * 31) * 32 +
      Math.round((C[t * 3 + 2] / 255) * 31);
    tt[k * 2] = temImagem ? (lisa ? ((id % 256) + 0.5) / 1024 : UV![k * 2] / 65535) : ((t % 256) + 0.5) / 256;
    tt[k * 2 + 1] = temImagem
      ? lisa
        ? (512 + Math.floor(id / 256) + 0.5) / 1024
        : UV![k * 2 + 1] / 65535 / 2
      : (Math.floor(t / 256) + 0.5) / 256;
  }
  const r = await reduzirPecaUV({ P: pp, T: tt, I: Uint32Array.from(I, (_, k) => k), tex, texW: lado }, alvo);
  const mapa = new Map<number, number>(),
    p: number[] = [],
    j: number[] = [],
    w: number[] = [],
    i: number[] = [],
    c: number[] = [],
    uv: number[] = [];
  for (let k = 0; k < r.p.length / 3; k++) {
    const ponto = r.p.slice(k * 3, k * 3 + 3).map((v) => Math.round(v * 64));
    const v = porPosicao.get(ponto.join(","));
    if (v == null) throw new Error("Redução gerou um vértice sem pesos na superfície de origem");
    let id = mapa.get(v);
    if (id == null) {
      id = mapa.size;
      mapa.set(v, id);
      p.push(...ponto);
      for (let e = 0; e < 4; e++) {
        j.push(J[v * 4 + e]);
        w.push(W[v * 4 + e]);
      }
    }
    i.push(id);
    const t = Math.floor(k / 3);
    const lisa = !temImagem || [1, 3, 5].every((e) => r.uv[t * 6 + e] >= 0.5);
    uv.push(
      Math.round((lisa ? 0.98 : Math.max(0, Math.min(1, r.uv[k * 2]))) * 65535),
      Math.round((lisa ? 0.98 : Math.max(0, Math.min(1, r.uv[k * 2 + 1]))) * 65535),
    );
    if (k % 3 === 0) c.push(...(lisa ? r.c.slice(k, k + 3).map((v) => Math.round(v * 255)) : [255, 255, 255]));
  }
  if (temImagem) {
    // A paleta só serve à projeção. No jogo as cores lisas ficam em C e amostram branco,
    // evitando mistura de cores na compressão e nos mipmaps de uma paleta de pixels isolados.
    tex.fill(255, 1024 * 512 * 3);
    imagemSaida =
      "data:image/webp;base64," +
      (
        await sharp(tex, { raw: { width: 1024, height: 1024, channels: 3 } })
          .webp({ quality: 92 })
          .toBuffer()
      ).toString("base64");
  }
  if (i.length / 3 > alvo || mapa.size > 65535)
    throw new Error(`Não foi possível reduzir a peça para ${alvo}: ${i.length / 3}`);
  return {
    ...d,
    tex: imagemSaida,
    malha: {
      p: b64(Int16Array.from(p)),
      j: b64(Uint8Array.from(j)),
      w: b64(Uint8Array.from(w)),
      i: b64(Uint16Array.from(i)),
      c: b64(Uint8Array.from(c)),
      ...(d.tex && UV ? { uv: b64(Uint16Array.from(uv)) } : {}),
    },
  };
}
