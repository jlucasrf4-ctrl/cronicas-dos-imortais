import { expect, it } from "vitest";
import sharp from "sharp";
import { reduzirAnimado } from "../../tools/lib/reduzir-animado.ts";
import type { DadosAnim } from "../../src/render/gl/esqueleto.ts";

it("reduzir roupa preserva as cores lisas junto da textura, os UVs e os pesos", async () => {
  const p: number[] = [],
    i: number[] = [],
    j: number[] = [],
    w: number[] = [];
  for (let y = 0; y <= 10; y++)
    for (let x = 0; x <= 10; x++) {
      p.push(x * 64, 0, y * 64);
      j.push(0, 0, 0, 0);
      w.push(255, 0, 0, 0);
      if (x < 10 && y < 10) {
        const v = y * 11 + x;
        i.push(v, v + 1, v + 11, v + 1, v + 12, v + 11);
      }
    }
  const b64 = (v: ArrayBufferView) => Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString("base64");
  const identidade = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const imagem = await sharp(Buffer.alloc(4 * 4 * 3, 255), { raw: { width: 4, height: 4, channels: 3 } })
    .webp({ lossless: true })
    .toBuffer();
  const d: DadosAnim = {
    versao: 1,
    juntas: ["Hips"],
    pais: [-1],
    repouso: [[0, 0, 0]],
    raiz: identidade,
    ibm: [identidade],
    clips: {},
    tex: "data:image/webp;base64," + imagem.toString("base64"),
    malha: {
      p: b64(Int16Array.from(p)),
      i: b64(Uint16Array.from(i)),
      j: b64(Uint8Array.from(j)),
      w: b64(Uint8Array.from(w)),
      c: b64(Uint8Array.from({ length: i.length }, (_, k) => [90, 60, 30][k % 3])),
      uv: b64(new Uint16Array(i.length * 2).fill(60000)),
    },
  };
  const r = await reduzirAnimado(d, 100),
    cores = Buffer.from(r.malha.c, "base64");
  expect(Buffer.from(r.malha.i, "base64").length / 6).toBeLessThanOrEqual(100);
  for (let k = 0; k < cores.length; k++) expect(Math.abs(cores[k] - [90, 60, 30][k % 3])).toBeLessThanOrEqual(5);
  const uv = new Uint16Array(Uint8Array.from(Buffer.from(r.malha.uv!, "base64")).buffer);
  expect([...uv].every((v) => v > 60000)).toBe(true);
  const pesos = Buffer.from(r.malha.w, "base64");
  for (let k = 0; k < pesos.length; k += 4) expect(pesos[k] + pesos[k + 1] + pesos[k + 2] + pesos[k + 3]).toBe(255);
});
