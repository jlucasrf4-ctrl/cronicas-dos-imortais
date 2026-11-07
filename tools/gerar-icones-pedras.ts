/* v7.7 — ícones das pedras comuns/semipreciosas e das runas absorvidas.

   Uso:  node tools/gerar-icones-pedras.ts [plano.json]      (padrão tools/modelos/icones_pedras.json)
   1. Fatia as folhas do plano (as pedras do GPT, fundo preto) com tools/lib/fatiar.ts em `<saida>/fatias/`;
      `apelidos` renomeia as peças achadas por componentes (`l1_1` → `obsidiana`).
   2. Pedras: para cada tipo de `pedras.tipos`, grava as PX_N[tipo] variantes `px_<tipo>_<n>.webp` (as mesmas chaves
      de antes: o jogo e os saves não mudam). A variante 1 é a pedra como veio; as outras giram até ±`giro`°×3,
      espelham e mudam um pouco o matiz (±`matiz`°×2) e o brilho (±`luz`×2), sempre do mesmo jeito.
   3. Runas: `rn_<elemento>_<1|2|3>.webp` (fraturada, capturada, preciosa) a partir de uma gema pintada (`de`) ou de
      uma fatia (`fatia`), com matiz/brilho/saturação opcionais. Acrescenta as regras .ico-rn_* que faltarem no fim
      do <style id="ico-css"> (src/styles/icones-pintados.css).
   Prévia: `<saida>/previa.png` (todas as pedras e as runas, 2×). */
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import sharp, { type Sharp } from "sharp";
import { fatiarFolha, type Plano } from "./lib/fatiar.ts";
import { PX_N } from "../src/data/icones.ts";

interface Tom {
  matiz?: number;
  luz?: number;
  sat?: number;
}
interface FonteRuna extends Tom {
  de?: string;
  fatia?: string;
}
interface PlanoIcones extends Plano {
  icones: string;
  css: string;
  apelidos: Record<string, string>;
  pedras: { lado: number; tipos: string[]; giro: number; matiz: number; luz: number };
  runas: { lado: number; elementos: Record<string, FonteRuna[]> };
}

const TRANSP = { r: 0, g: 0, b: 0, alpha: 0 };

/** Aplica o tom, encaixa num quadrado transparente de `lado` e grava como WEBP. */
async function gravar(s: Sharp, t: Tom, lado: number, arq: string) {
  if (t.matiz || t.luz || t.sat) s = s.modulate({ hue: t.matiz ?? 0, brightness: t.luz ?? 1, saturation: t.sat ?? 1 });
  const png = await s.png().toBuffer();
  const ap = await sharp(png).trim({ threshold: 1 }).toBuffer();
  writeFileSync(
    arq,
    await sharp(ap).resize(lado, lado, { fit: "contain", background: TRANSP }).webp({ quality: 88 }).toBuffer(),
  );
}

async function main() {
  const arqPlano = process.argv[2] ?? "tools/modelos/icones_pedras.json";
  const P = JSON.parse(readFileSync(arqPlano, "utf8")) as PlanoIcones;
  const fatias = join(P.saida, "fatias");
  for (const f of P.folhas) {
    const r = await fatiarFolha({ ...P, saida: fatias }, f);
    console.log(`${f.arquivo}: ${r.fatias.length} peças`);
  }
  for (const [de, para] of Object.entries(P.apelidos))
    if (existsSync(join(fatias, de + ".webp"))) renameSync(join(fatias, de + ".webp"), join(fatias, para + ".webp"));

  const feitos: string[] = [];
  const Q = P.pedras;
  for (const tipo of Q.tipos) {
    const n = PX_N[tipo];
    if (!n) throw new Error(`${tipo}: sem contagem em PX_N (src/data/icones.ts)`);
    const fonte = readFileSync(join(fatias, tipo + ".webp"));
    for (let i = 0; i < n; i++) {
      let s = sharp(fonte);
      if (i % 2) s = s.flop();
      const giro = i ? (((i * 37) % 7) - 3) * Q.giro : 0;
      if (giro) s = sharp(await s.png().toBuffer()).rotate(giro, { background: TRANSP });
      const t = i ? { matiz: (((i * 53) % 5) - 2) * Q.matiz, luz: 1 + (((i * 29) % 5) - 2) * Q.luz } : {};
      const k = `px_${tipo}_${i + 1}`;
      await gravar(s, t, Q.lado, join(P.icones, k + ".webp"));
      feitos.push(k);
    }
  }

  const novas: string[] = [];
  for (const [el, fontes] of Object.entries(P.runas.elementos))
    for (const [i, f] of fontes.entries()) {
      const arq = f.de ? join(P.icones, f.de + ".webp") : join(fatias, f.fatia + ".webp");
      const k = `rn_${el}_${i + 1}`;
      await gravar(sharp(readFileSync(arq)), f, P.runas.lado, join(P.icones, k + ".webp"));
      feitos.push(k);
      novas.push(k);
    }
  let css = readFileSync(P.css, "utf8");
  const fimLinha = css.includes("\r\n") ? "\r\n" : "\n";
  const faltam = novas.filter((k) => !css.includes(`.ico-${k}{`));
  if (faltam.length) {
    if (!css.endsWith(fimLinha)) css += fimLinha;
    css += faltam.map((k) => `.ico-${k}{background-image:url(/src/assets/icons/${k}.webp)}`).join(fimLinha) + fimLinha;
    writeFileSync(P.css, css);
  }

  // prévia: tudo em 2×, uma linha por tipo de pedra e uma por elemento
  const linhas: string[][] = [
    ...Q.tipos.map((t) => feitos.filter((k) => new RegExp(`^px_${t}_\\d+$`).test(k))),
    ...Object.keys(P.runas.elementos).map((el) => feitos.filter((k) => new RegExp(`^rn_${el}_\\d+$`).test(k))),
  ];
  const C = 96,
    W = Math.max(...linhas.map((l) => l.length)) * C;
  const camadas = [];
  for (const [y, l] of linhas.entries())
    for (const [x, k] of l.entries())
      camadas.push({
        input: await sharp(join(P.icones, k + ".webp"))
          .resize(C, C, { fit: "contain", background: TRANSP })
          .png()
          .toBuffer(),
        left: x * C,
        top: y * C,
      });
  mkdirSync(P.saida, { recursive: true });
  await sharp({
    create: { width: W, height: linhas.length * C, channels: 4, background: { r: 29, g: 23, b: 18, alpha: 1 } },
  })
    .composite(camadas)
    .png()
    .toFile(join(P.saida, "previa.png"));
  console.log(
    `${feitos.length} ícones (${faltam.length} regras novas no CSS); prévia em ${join(P.saida, "previa.png")}`,
  );
}

await main();
