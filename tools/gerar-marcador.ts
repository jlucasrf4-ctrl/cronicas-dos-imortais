/* v8.0 — o marcador do herói no mapa (anel com a ponta para baixo, no lugar do losango), arte do GPT em fundo preto.

   Uso:  node tools/gerar-marcador.ts [plano.json] [--simular]      (padrão tools/modelos/marcador.json)
   O plano diz a folha, as caixas [x0, y0, x1, y1] de cada peça (pixels da folha), a altura final e o limiar do preto.
   O brilho vira transparência (alfa = canal mais forte, cor dividida por ele: o mesmo brilho sobre qualquer fundo),
   a peça é aparada e reduzida. Saída: <saida>/<nome>.webp. Prévia: <previas>/marcadores.png, no tamanho do jogo e
   ampliada, sobre a cor do mapa. */
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

interface PlanoMarcador {
  fonte: string;
  saida: string;
  previas: string;
  altura: number;
  limiar: number;
  pecas: Record<string, [number, number, number, number]>;
}

async function main() {
  const args = process.argv.slice(2);
  const plano = JSON.parse(
    readFileSync(args.find((a) => !a.startsWith("--")) ?? "tools/modelos/marcador.json", "utf8"),
  ) as PlanoMarcador;
  mkdirSync(plano.previas, { recursive: true });
  const previas: { input: Buffer; left: number; top: number }[] = [];
  let x = 10;
  for (const [nome, [x0, y0, x1, y1]] of Object.entries(plano.pecas)) {
    const { data, info } = await sharp(plano.fonte)
      .extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const n = info.width * info.height,
      rgba = Buffer.alloc(n * 4);
    for (let i = 0; i < n; i++) {
      const r = data[i * 3],
        g = data[i * 3 + 1],
        b = data[i * 3 + 2],
        m = Math.max(r, g, b);
      if (m < plano.limiar) continue;
      // o preto do fundo some aos poucos acima do limiar (sem serrilhado na borda do brilho)
      const a = Math.min(1, (m - plano.limiar) / (255 - plano.limiar)) * (m / 255);
      rgba[i * 4] = Math.round((r * 255) / m);
      rgba[i * 4 + 1] = Math.round((g * 255) / m);
      rgba[i * 4 + 2] = Math.round((b * 255) / m);
      rgba[i * 4 + 3] = Math.round(a * 255);
    }
    const peca = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
      .trim({ threshold: 1 })
      .resize({ height: plano.altura })
      .png()
      .toBuffer();
    const meta = await sharp(peca).metadata();
    if (!args.includes("--simular"))
      await sharp(peca)
        .webp({ quality: 90, alphaQuality: 100 })
        .toFile(join(plano.saida, nome + ".webp"));
    console.log(`${nome}: ${meta.width}×${meta.height}`);
    // prévia: tamanho do jogo (~22 px de altura) e o arquivo inteiro
    const peq = await sharp(peca).resize({ height: 22 }).toBuffer();
    previas.push({ input: peq, left: x, top: 10 }, { input: peca, left: x, top: 50 });
    x += (meta.width ?? 0) + 20;
  }
  await sharp({ create: { width: x, height: 50 + plano.altura + 10, channels: 3, background: "#8fa35a" } })
    .composite(previas)
    .png()
    .toFile(join(plano.previas, "marcadores.png"));
  console.log(`prévia em ${join(plano.previas, "marcadores.png")}`);
}

await main();
