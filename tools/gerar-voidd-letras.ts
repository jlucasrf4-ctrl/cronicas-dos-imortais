/* v7.7 — o O (portal), o V e o IDD do logotipo Voidd World, arte do GPT (fundo transparente), para a vinheta de
   abertura (src/intro/voidd.ts).

   Uso:  node tools/gerar-voidd-letras.ts [plano.json]      (padrão tools/modelos/voidd_letras.json)
   O: caixa do alfa nas `colunas` da folha; centro = meio da caixa; furo e borda = medianas, em 64 direções, do raio
      onde o alfa passa de 128 (de dentro para fora / de fora para dentro). Sai um quadrado centrado no O, com a
      borda inteira dentro, redimensionado para `lado` (voidd_o.webp).
   V: caixa do alfa nas `colunas` (com a fumaça); `glifo` = a caixa só da letra (medida à mão na folha, em pixels),
      porque a fumaça é tão opaca quanto a letra. Sai a caixa inteira com altura `lado` (voidd_v.webp).
   IDD: imagem própria (`arquivo`), as três letras juntas; caixa do alfa inteira, com altura `altura`
      (voidd_idd.webp); `glifo` = caixa só das letras, pelo contorno claro (medida à mão, em pixels do arquivo).
   Medidas em `dados` (frações da imagem de saída): o.furo e o.borda (raio ÷ meio lado), v.glifo e idd.glifo
   [x0, y0, x1, y1].
   Prévias no fundo escuro em build/modelos/voidd_letras/. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

interface Plano {
  folha: string;
  saida: string;
  dados: string;
  previas: string;
  lado: number;
  qualidade: number;
  O: { colunas: [number, number] };
  V: { colunas: [number, number]; glifo: [number, number, number, number] };
  IDD: { arquivo: string; glifo: [number, number, number, number]; altura: number };
}

const plano = JSON.parse(readFileSync(process.argv[2] ?? "tools/modelos/voidd_letras.json", "utf8")) as Plano;
const { data, info } = await sharp(plano.folha).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width,
  H = info.height;
const alfa = (x: number, y: number) =>
  x < 0 || y < 0 || x >= W || y >= H ? 0 : data[(Math.round(y) * W + Math.round(x)) * 4 + 3];
function caixa([c0, c1]: [number, number]) {
  let x0 = W,
    y0 = H,
    x1 = 0,
    y1 = 0;
  for (let y = 0; y < H; y++)
    for (let x = c0; x < c1; x++)
      if (alfa(x, y) > 40) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  return { x0, y0, x1, y1 };
}
const mediana = (v: number[]) => v.sort((a, b) => a - b)[v.length >> 1];
const webp = (s: ReturnType<typeof sharp>, arq: string) =>
  s.webp({ quality: plano.qualidade, alphaQuality: 100 }).toFile(arq);
mkdirSync(plano.previas, { recursive: true });
async function previa(arq: string, nome: string) {
  const m = await sharp(arq).metadata();
  await sharp({ create: { width: m.width!, height: m.height!, channels: 3, background: "#0a0620" } })
    .composite([{ input: arq }])
    .png()
    .toFile(join(plano.previas, nome + ".png"));
}

// O
const cO = caixa(plano.O.colunas);
const cx = (cO.x0 + cO.x1) / 2,
  cy = (cO.y0 + cO.y1) / 2;
const furos: number[] = [],
  bordas: number[] = [];
const rMax = Math.max(cO.x1 - cO.x0, cO.y1 - cO.y0);
for (let k = 0; k < 64; k++) {
  const a = (k / 64) * Math.PI * 2,
    dx = Math.cos(a),
    dy = Math.sin(a);
  let r = 0;
  while (r < rMax && alfa(cx + dx * r, cy + dy * r) < 128) r++;
  furos.push(r);
  let R = rMax;
  while (R > 0 && alfa(cx + dx * R, cy + dy * R) < 128) R--;
  bordas.push(R);
}
const meio = Math.ceil(Math.max(cx - cO.x0, cO.x1 - cx, cy - cO.y0, cO.y1 - cy)) + 4;
const arqO = join(plano.saida, "voidd_o.webp");
// o quadrado pode passar da folha: estende com transparente antes de recortar (em duas etapas: o sharp faz o
// recorte antes da extensão quando os dois estão na mesma cadeia)
const estendida = await sharp(plano.folha)
  .extend({ top: meio, bottom: meio, left: meio, right: meio, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
await webp(
  sharp(estendida)
    .extract({ left: Math.round(cx), top: Math.round(cy), width: meio * 2, height: meio * 2 })
    .resize(plano.lado, plano.lado),
  arqO,
);
await previa(arqO, "O");

// V
const cV = caixa(plano.V.colunas);
const larg = cV.x1 - cV.x0 + 1,
  alt = cV.y1 - cV.y0 + 1;
const arqV = join(plano.saida, "voidd_v.webp");
await webp(
  sharp(plano.folha).extract({ left: cV.x0, top: cV.y0, width: larg, height: alt }).resize({ height: plano.lado }),
  arqV,
);
await previa(arqV, "V");
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
/** caixa da letra (pixels da fonte) → frações da caixa recortada */
const fracoes = ([g0, g1, g2, g3]: number[], c: { x0: number; y0: number }, l: number, a: number) => [
  r4((g0 - c.x0) / l),
  r4((g1 - c.y0) / a),
  r4((g2 - c.x0) / l),
  r4((g3 - c.y0) / a),
];

// IDD (arquivo próprio): caixa do alfa inteira
const idd = await sharp(plano.IDD.arquivo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const ci = { x0: idd.info.width, y0: idd.info.height, x1: 0, y1: 0 };
for (let y = 0; y < idd.info.height; y++)
  for (let x = 0; x < idd.info.width; x++)
    if (idd.data[(y * idd.info.width + x) * 4 + 3] > 40) {
      ci.x0 = Math.min(ci.x0, x);
      ci.y0 = Math.min(ci.y0, y);
      ci.x1 = Math.max(ci.x1, x);
      ci.y1 = Math.max(ci.y1, y);
    }
const largI = ci.x1 - ci.x0 + 1,
  altI = ci.y1 - ci.y0 + 1;
const arqIDD = join(plano.saida, "voidd_idd.webp");
await webp(
  sharp(plano.IDD.arquivo)
    .extract({ left: ci.x0, top: ci.y0, width: largI, height: altI })
    .resize({ height: Math.min(altI, plano.IDD.altura) }),
  arqIDD,
);
await previa(arqIDD, "IDD");

const dados = {
  o: { furo: r4(mediana(furos) / meio), borda: r4(mediana(bordas) / meio) },
  v: { glifo: fracoes(plano.V.glifo, cV, larg, alt) },
  idd: { glifo: fracoes(plano.IDD.glifo, ci, largI, altI) },
};
writeFileSync(plano.dados, JSON.stringify(dados, null, 2) + "\n");
console.log(
  `voidd letras: O (furo ${dados.o.furo}, borda ${dados.o.borda}) → ${arqO}; V ${larg}×${alt} → ${arqV};` +
    ` IDD ${largI}×${altI} → ${arqIDD}`,
);
