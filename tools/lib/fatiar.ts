/* Fatiar uma folha de sprites em ícones .webp (a parte com sharp; os algoritmos estão em ./fatias.ts).
   Usado por tools/slice-sheet.ts; testado em tests/unit/fatias.test.ts com uma folha sintética.
   Dois modos, como os antigos scripts/assets/slice*.py:
   - "componentes" (slice2–7): acha as peças pela máscara (limiar → abertura → fechamento → buracos → rótulos),
     agrupa em linhas e recorta cada uma com folga, tirando o fundo escuro ligado à borda.
   - "grade" (slice_icons): a folha é uma grade fixa de colunas × linhas, um nome por célula. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import sharp, { type Sharp } from "sharp";
import {
  abrir,
  alfaFundo,
  caixaAlfa,
  emLinhas,
  fechar,
  limiar,
  limparAlfa,
  pecas,
  preencherBuracos,
  quadrar,
  recortar,
  type Caixa,
  type Elemento,
  type Imagem,
} from "./fatias.ts";

/** Como cada peça é recortada e gravada (valores padrão entre parênteses). */
export interface OpcoesRecorte {
  /** Folga em volta da caixa da peça, em px (6). */
  margem?: number;
  /** Limiar do fundo escuro: max(R, G, B) abaixo dele, ligado à borda, fica transparente (48; 0 = não tira). */
  fundo?: number;
  /** Também tira a região escura do centro (false). */
  centro?: boolean;
  /** Lado do filtro de mínimo no alfa (2). */
  erosao?: number;
  /** σ do desfoque do alfa (0). */
  desfoque?: number;
  /** Apaga grupos de pixels menores que esta fração do maior (0 = não apaga; os scripts usavam 0.08–0.12). */
  limparAlfa?: number;
  /** Recorta pelo alfa antes de gravar, com esta fração do lado de folga (desligado se ausente; slice_icons: 0.06). */
  aparar?: number;
  /** Saída quadrada de lado `quadrado` (96), ou com altura `altura` mantendo a proporção (o `cut_tight`). */
  quadrado?: number;
  altura?: number;
  /** Qualidade WEBP (86). */
  qualidade?: number;
}

export interface PlanoFolha extends OpcoesRecorte {
  /** Arquivo da folha, relativo à `origem` do plano. */
  arquivo: string;
  modo: "componentes" | "grade";
  /** grade: um nome por célula, linha a linha (null = pula). componentes: um nome por linha de peças (a última
      se repete); cada peça vira `<nome>_<n>`, numerada por nome. */
  nomes?: (string | null)[];
  /** componentes sem `nomes`: as peças viram `<prefixo>_r<linha>_<coluna>` (padrão: o nome do arquivo). */
  prefixo?: string;
  /* modo grade */
  colunas?: number;
  linhas?: number;
  /* modo componentes */
  /** Só procura dentro desta caixa. */
  caixa?: Caixa;
  /** Limiar das peças: max(R, G, B) acima dele (60). */
  limiar?: number;
  /** Abertura e fechamento da máscara (sem abertura; fechamento = cruz 2×). */
  abrir?: Elemento;
  fechar?: Elemento;
  /** Liga os buracos da máscara antes de rotular (true). */
  preencher?: boolean;
  /** Filtro das peças, todos exclusivos: área, lados mínimos e máximos (1200, 36, sem máximo), e só largura ou só
      altura mínima (sem). */
  areaMin?: number;
  ladoMin?: number;
  ladoMax?: number;
  largMin?: number;
  altMin?: number;
  /** Descarta peças que começam à esquerda deste x. */
  xMin?: number;
  /** Distância entre centros que ainda conta como a mesma linha (45). */
  folgaLinha?: number;
}

export interface Plano {
  /** Pasta das folhas e pasta de saída (relativas à pasta atual). */
  origem: string;
  saida: string;
  folhas: PlanoFolha[];
}

export interface Fatia {
  nome: string;
  /** Caixa na folha (antes da margem). */
  caixa: Caixa;
  linha: number;
  coluna: number;
}

export interface ResultadoFolha {
  arquivo: string;
  fatias: Fatia[];
  /** Peças por linha (modo componentes). */
  porLinha: number[];
  /** Quantas peças cada nome recebeu. */
  contagens: Record<string, number>;
}

/** Lê uma imagem como RGBA cru (por um buffer: com o caminho, o cache do libvips deixa o arquivo aberto no Windows). */
export async function lerRGBA(caminho: string): Promise<Imagem> {
  const { data, info } = await sharp(readFileSync(caminho)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, canais: 4, d: new Uint8Array(data.buffer, data.byteOffset, data.length) };
}

/** Acha as fatias de uma folha, sem gravar nada. */
export function planejarFolha(img: Imagem, p: PlanoFolha): Omit<ResultadoFolha, "arquivo"> {
  const fatias: Fatia[] = [];
  const contagens: Record<string, number> = {};
  if (p.modo === "grade") {
    const C = p.colunas ?? 4;
    const L = p.linhas ?? 4;
    const cw = img.w / C;
    const ch = img.h / L;
    (p.nomes ?? []).forEach((nome, i) => {
      if (!nome) return;
      const x = i % C;
      const y = Math.floor(i / C);
      if (y >= L) throw new Error(`${p.arquivo}: ${nome} cai fora da grade ${C}×${L}`);
      const caixa: Caixa = [Math.floor(x * cw), Math.floor(y * ch), Math.floor((x + 1) * cw), Math.floor((y + 1) * ch)];
      fatias.push({ nome, caixa, linha: y + 1, coluna: x + 1 });
      contagens[nome] = (contagens[nome] ?? 0) + 1;
    });
    return { fatias, porLinha: [], contagens };
  }
  const area: Caixa = p.caixa ?? [0, 0, img.w, img.h];
  let m = limiar(recortar(img, area), p.limiar ?? 60);
  if (p.abrir) m = abrir(m, p.abrir);
  m = fechar(m, p.fechar ?? { forma: "cruz", vezes: 2 });
  if (p.preencher ?? true) m = preencherBuracos(m);
  const filtro = {
    areaMin: p.areaMin ?? 1200,
    ladoMin: p.ladoMin ?? 36,
    ladoMax: p.ladoMax,
    largMin: p.largMin,
    altMin: p.altMin,
  };
  let cx = pecas(m, filtro, area[0], area[1]);
  if (p.xMin !== undefined) cx = cx.filter((b) => b[0] >= p.xMin!);
  const linhas = emLinhas(cx, p.folgaLinha ?? 45);
  const base = p.prefixo ?? basename(p.arquivo, extname(p.arquivo));
  linhas.forEach((linha, li) =>
    linha.forEach((caixa, ci) => {
      let nome: string;
      if (p.nomes?.length) {
        const n = p.nomes[Math.min(li, p.nomes.length - 1)];
        if (!n) return;
        contagens[n] = (contagens[n] ?? 0) + 1;
        nome = `${n}_${contagens[n]}`;
      } else {
        nome = `${base}_r${li + 1}_${ci + 1}`;
        contagens[nome] = 1;
      }
      fatias.push({ nome, caixa, linha: li + 1, coluna: ci + 1 });
    }),
  );
  return { fatias, porLinha: linhas.map((l) => l.length), contagens };
}

/** Recorta uma fatia: margem, alfa do fundo (combinado com o alfa da própria folha), limpeza e aparo. */
export function recortarFatia(img: Imagem, caixa: Caixa, o: OpcoesRecorte, grade = false): Imagem {
  const mg = grade ? 0 : (o.margem ?? 6);
  const c = recortar(img, [caixa[0] - mg, caixa[1] - mg, caixa[2] + mg, caixa[3] + mg]);
  const lim = o.fundo ?? 48;
  if (lim > 0) {
    const a = alfaFundo(c, lim, { centro: o.centro, erosao: o.erosao, desfoque: o.desfoque });
    for (let i = 0; i < a.length; i++) c.d[i * 4 + 3] = Math.min(c.d[i * 4 + 3], a[i]);
  }
  if (o.limparAlfa) limparAlfa(c, o.limparAlfa);
  if (o.aparar === undefined) return c;
  const b = caixaAlfa(c);
  if (!b) return c;
  const ap = recortar(c, b);
  return quadrar(ap, Math.floor(Math.max(ap.w, ap.h) * o.aparar));
}

/** Grava a peça como WEBP, quadrada (centralizada) ou pela altura. Devolve a imagem gravada, em RGBA cru. */
export async function gravarFatia(peca: Imagem, caminho: string, o: OpcoesRecorte): Promise<Imagem> {
  let s: Sharp;
  if (o.altura) {
    s = sharp(peca.d, { raw: { width: peca.w, height: peca.h, channels: 4 } }).resize(
      Math.max(8, Math.round((peca.w * o.altura) / peca.h)),
      o.altura,
      { fit: "fill" },
    );
  } else {
    const q = quadrar(peca);
    const lado = o.quadrado ?? 96;
    s = sharp(q.d, { raw: { width: q.w, height: q.h, channels: 4 } }).resize(lado, lado, { fit: "fill" });
  }
  // o resize vai antes do webp num pipeline só; o raw de volta vem da imagem já redimensionada
  const { data, info } = await s.clone().raw().toBuffer({ resolveWithObject: true });
  writeFileSync(caminho, await s.webp({ quality: o.qualidade ?? 86 }).toBuffer());
  return { w: info.width, h: info.height, canais: 4, d: new Uint8Array(data.buffer, data.byteOffset, data.length) };
}

/** Prévia: as peças gravadas, uma linha da folha por linha, em células de 64 px sobre cinza. */
async function gravarPrevia(caminho: string, pecas: { f: Fatia; img: Imagem }[]) {
  const L = Math.max(...pecas.map((p) => p.f.linha));
  const C = Math.max(...pecas.map((p) => p.f.coluna));
  const fundo = sharp({
    create: { width: 64 * C, height: 64 * L, channels: 4, background: { r: 60, g: 60, b: 60, alpha: 1 } },
  });
  const camadas = await Promise.all(
    pecas.map(async ({ f, img }) => ({
      input: await sharp(img.d, { raw: { width: img.w, height: img.h, channels: 4 } })
        .resize(64, 64, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer(),
      left: (f.coluna - 1) * 64,
      top: (f.linha - 1) * 64,
    })),
  );
  writeFileSync(caminho, await fundo.composite(camadas).png().toBuffer());
}

/** Fatia uma folha do plano. Com `simular`, só acha as peças. Grava `<saida>/<nome>.webp` e `<saida>/previa_<folha>.png`. */
export async function fatiarFolha(plano: Plano, p: PlanoFolha, simular = false): Promise<ResultadoFolha> {
  const img = await lerRGBA(join(plano.origem, p.arquivo));
  const r = { arquivo: p.arquivo, ...planejarFolha(img, p) };
  if (simular || !r.fatias.length) return r;
  mkdirSync(plano.saida, { recursive: true });
  const gravadas: { f: Fatia; img: Imagem }[] = [];
  for (const f of r.fatias) {
    const peca = recortarFatia(img, f.caixa, p, p.modo === "grade");
    gravadas.push({ f, img: await gravarFatia(peca, join(plano.saida, f.nome + ".webp"), p) });
  }
  await gravarPrevia(join(plano.saida, `previa_${basename(p.arquivo, extname(p.arquivo))}.png`), gravadas);
  return r;
}
