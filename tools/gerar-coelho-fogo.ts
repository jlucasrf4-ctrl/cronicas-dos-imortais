/* v8.0 — o coelho de fogo da cinemática de abertura (src/intro/cinematica.ts lê src/assets/models/coelho_fogo.json):
   o coelho pisa na runa, o clarão, e é ele que levanta e ruge (o Tripo chamou o .glb de "fire wolf").

   Uso:  node tools/gerar-coelho-fogo.ts [plano.json] [--simular]      (padrão tools/modelos/coelho_fogo.json)
   O .glb é uma folha com várias poses (sem esqueleto); `regiao` escolhe uma (a ilha cujo centro cai na caixa x/y da
   folha: a de cima à direita, de lado, rondando, com a cauda). Reduz a `tris` triângulos com uma cor por triângulo (tools/lib/peca.ts, o
   mesmo das peças do cenário), gira `giro` graus em y (a frente vai para +x, como a fera feita por código), põe a base
   em y=0, centra e normaliza (maior medida = 1). Saída no formato das peças de cenario.json: { p (Int16 ×20000),
   c (Uint8 por triângulo) } em base64. Prévias em build/modelos/coelho_fogo/ (frente, lado e de cima, como na câmera). */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { recortar, desenhar, type Regiao } from "./lib/glb.ts";
import { reduzirPeca } from "./lib/peca.ts";

interface Plano {
  glb: string;
  regiao: Regiao;
  saida: string;
  previas: string;
  cache: string;
  texW: number;
  tris: number;
  giro: number;
}

const args = process.argv.slice(2);
const plano = JSON.parse(
  readFileSync(args.find((a) => !a.startsWith("--")) ?? "tools/modelos/coelho_fogo.json", "utf8"),
) as Plano;
const b64 = (a: ArrayBufferView) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString("base64");

const m = await recortar(plano.glb, plano.regiao, plano.texW, plano.cache);
const pc = await reduzirPeca(m, plano.tris);
const g = (plano.giro * Math.PI) / 180,
  cg = Math.cos(g),
  sg = Math.sin(g),
  p = pc.p.slice();
for (let i = 0; i < p.length; i += 3) {
  const x = p[i],
    z = p[i + 2];
  p[i] = x * cg + z * sg;
  p[i + 2] = -x * sg + z * cg;
}
const mn = [Infinity, Infinity, Infinity],
  mx = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < p.length; i += 3)
  for (let k = 0; k < 3; k++) {
    mn[k] = Math.min(mn[k], p[i + k]);
    mx[k] = Math.max(mx[k], p[i + k]);
  }
const tam = [0, 1, 2].map((k) => mx[k] - mn[k]),
  s = 1 / Math.max(...tam),
  c = [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2];
for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) p[i + k] = (p[i + k] - c[k]) * s;

// prévias: frente (de +z), lado (de +x) e de cima a 50° (a câmera do jogo)
mkdirSync(plano.previas, { recursive: true });
const idx = Array.from({ length: p.length / 3 }, (_, k) => k),
  cor = (t: number) => [0, 1, 2].map((e) => 255 * pc.c[t * 3 + e]);
for (const vista of ["frente", "lado"] as const)
  await desenhar(join(plano.previas, vista + ".png"), p, idx, cor, { vista, W: 600 });
const el = (35 * Math.PI) / 180,
  yaw = (40 * Math.PI) / 180,
  G: number[] = [];
for (let i = 0; i < p.length; i += 3) {
  let x = p[i],
    y = p[i + 1],
    z = p[i + 2];
  [x, z] = [x * Math.cos(yaw) - z * Math.sin(yaw), x * Math.sin(yaw) + z * Math.cos(yaw)];
  [y, z] = [y * Math.cos(el) - z * Math.sin(el), y * Math.sin(el) + z * Math.cos(el)];
  G.push(x, y, z);
}
await desenhar(join(plano.previas, "tres_quartos.png"), G, idx, cor, { W: 600 });

console.log(
  `coelho de fogo: ${m.I.length / 3} → ${pc.c.length / 3} triângulos; caixa x ${tam[0].toFixed(3)} y ${tam[1].toFixed(3)} z ${tam[2].toFixed(3)}` +
    ` → prévias em ${plano.previas}`,
);
if (!args.includes("--simular")) {
  const json = JSON.stringify({
    p: b64(Int16Array.from(p, (v) => Math.round(v * 20000))),
    c: b64(Uint8Array.from(pc.c, (v) => Math.round(Math.min(1, Math.max(0, v)) * 255))),
  });
  writeFileSync(plano.saida, json);
  console.log(`${plano.saida}: ${(json.length / 1024).toFixed(0)} KB`);
}
