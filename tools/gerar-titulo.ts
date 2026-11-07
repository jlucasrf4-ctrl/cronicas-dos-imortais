/* v7.7 — arte da tela de título (src/ui/titulo.ts): fundo, título "Crônicas dos Imortais" e o selo VOIDD.

   Uso:  node tools/gerar-titulo.ts [plano.json]      (padrão tools/modelos/titulo.json)
   Fundos: cada `fundos.<nome>` (arte do GPT sem texto) → src/assets/art/titulo_<nome>.webp, no tamanho original.
   Título: o PNG transparente, cortado na caixa do alfa e reduzido a `logoLargura` → titulo_logo.webp.
   Selo: o V, o O e o IDD da vinheta (tools/gerar-voidd-letras.ts) montados numa imagem só, como no logotipo da
   vinheta (src/intro/voidd.ts): as caixas das letras com altura `selo.cap` px, o O com diâmetro cap ÷ `capO`, o vão
   do O = `slotO` × diâmetro, espaços em frações do diâmetro → titulo_selo.webp (o "WORLD" embaixo é HTML).
   Prévias no fundo escuro em build/modelos/titulo/. */
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

interface Plano {
  fundos: Record<string, string>;
  logo: string;
  letras: string;
  arte: { o: string; v: string; idd: string };
  saida: string;
  previas: string;
  qualidade: { fundo: number; logo: number };
  logoLargura: number;
  selo: { cap: number; capO: number; slotO: number; espacoIdd: number; espacoV: number };
}
interface Letras {
  o: { furo: number; borda: number };
  v: { glifo: number[] };
  idd: { glifo: number[] };
}

const plano = JSON.parse(readFileSync(process.argv[2] ?? "tools/modelos/titulo.json", "utf8")) as Plano;
mkdirSync(plano.previas, { recursive: true });
const feitos: string[] = [];

// fundos
for (const [nome, arq] of Object.entries(plano.fundos)) {
  const saida = join(plano.saida, `titulo_${nome}.webp`);
  await sharp(arq).webp({ quality: plano.qualidade.fundo }).toFile(saida);
  feitos.push(saida);
}

// título
const logo = await sharp(plano.logo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const c = { x0: logo.info.width, y0: logo.info.height, x1: 0, y1: 0 };
for (let y = 0; y < logo.info.height; y++)
  for (let x = 0; x < logo.info.width; x++)
    if (logo.data[(y * logo.info.width + x) * 4 + 3] > 24) {
      c.x0 = Math.min(c.x0, x);
      c.y0 = Math.min(c.y0, y);
      c.x1 = Math.max(c.x1, x);
      c.y1 = Math.max(c.y1, y);
    }
const arqLogo = join(plano.saida, "titulo_logo.webp");
await sharp(plano.logo)
  .extract({ left: c.x0, top: c.y0, width: c.x1 - c.x0 + 1, height: c.y1 - c.y0 + 1 })
  .resize({ width: Math.min(plano.logoLargura, c.x1 - c.x0 + 1) })
  .webp({ quality: plano.qualidade.logo, alphaQuality: 100 })
  .toFile(arqLogo);
feitos.push(arqLogo);

// selo: mesma conta do logotipo da vinheta (encaixar em src/intro/voidd.ts)
const L = JSON.parse(readFileSync(plano.letras, "utf8")) as Letras;
const { cap, capO, slotO, espacoIdd, espacoV } = plano.selo;
const D = cap / capO; // diâmetro do O
async function letra(arq: string, glifo: number[]) {
  const m = await sharp(arq).metadata();
  const [g0, g1, g2, g3] = glifo;
  const h = Math.round(cap / (g3 - g1)),
    w = Math.round((h * m.width!) / m.height!);
  return { buf: await sharp(arq).resize(w, h).png().toBuffer(), w, h, g0, g1, g2, g3 };
}
const V = await letra(plano.arte.v, L.v.glifo),
  IDD = await letra(plano.arte.idd, L.idd.glifo);
const ladoO = Math.round(D / L.o.borda);
const O = await sharp(plano.arte.o).resize(ladoO, ladoO).png().toBuffer();
// x da borda esquerda da caixa de cada letra; linha do meio y = meio da caixa das letras
const folga = Math.ceil(Math.max(V.h, IDD.h, ladoO) * 0.6);
const meio = folga;
const xV = folga,
  fimV = xV + (V.g2 - V.g0) * V.w,
  centroO = fimV + espacoV * D + (slotO * D) / 2,
  xIdd = fimV + espacoV * D + slotO * D + espacoIdd * D,
  fimIdd = xIdd + (IDD.g2 - IDD.g0) * IDD.w;
const W = Math.ceil(fimIdd + folga),
  H = Math.ceil(meio * 2);
const pos = (l: typeof V, x: number) => ({
  input: l.buf,
  left: Math.round(x - l.g0 * l.w),
  top: Math.round(meio - ((l.g1 + l.g3) / 2) * l.h),
});
// o furo do O é transparente: como no fim da vinheta, o buraco negro o preenche e os olhos do Voodi aparecem nele
const rFuro = (L.o.furo / L.o.borda) * (D / 2) * 1.04,
  rOlho = D * 0.0375;
const buraco = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<circle cx="${centroO}" cy="${meio}" r="${rFuro}" fill="#000"/>` +
    [-1, 1]
      .map(
        (s) =>
          `<ellipse cx="${centroO + s * D * 0.065}" cy="${meio - D * 0.015}" rx="${rOlho}" ry="${rOlho * 1.35}" fill="#f2f0ff"/>`,
      )
      .join("") +
    `</svg>`,
);
const selo = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([
    { input: buraco, left: 0, top: 0 },
    { input: O, left: Math.round(centroO - ladoO / 2), top: Math.round(meio - ladoO / 2) },
    pos(V, xV),
    pos(IDD, xIdd),
  ])
  .png()
  .toBuffer();
const arqSelo = join(plano.saida, "titulo_selo.webp");
await sharp(selo).trim({ threshold: 1 }).webp({ quality: plano.qualidade.logo, alphaQuality: 100 }).toFile(arqSelo);
feitos.push(arqSelo);

for (const arq of feitos) {
  const m = await sharp(arq).metadata();
  await sharp({ create: { width: m.width!, height: m.height!, channels: 3, background: "#0a0620" } })
    .composite([{ input: arq }])
    .png()
    .toFile(join(plano.previas, arq.split(/[\\/]/).pop()!.replace(".webp", ".png")));
}
for (const arq of feitos) {
  const m = await sharp(arq).metadata();
  console.log(`titulo: ${arq} ${m.width}×${m.height}`);
}
