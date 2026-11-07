/* Corrige "buracos" nos ícones pintados (porta do antigo patches/p61_corrige_buracos_icones.py, sem scipy).

   Uso:  node tools/fix-icon-holes.ts [--simular] [pasta]      (padrão: src/assets/icons)
   Para cada .webp: pixels com alfa <= 20 que NÃO se ligam à borda (vizinhança 4, como o binary_fill_holes do
   scipy) são buracos. Cada buraco (componente 4-conexo) com 3 px até 12% da imagem cuja cor média (máximo de
   R/G/B por pixel) passa de 48 era conteúdo apagado por engano: volta a ter alfa 255. O fundo escuro da folha de
   sprites fica como está. Ícones de moldura (frame*, moldura*, icf*) são pulados. Regrava em WEBP qualidade 88.
   Rodado UMA vez na Fase 2 sobre os ícones extraídos (217 corrigidos). Não rode de novo sem motivo: a regravação
   com perdas pode abrir alguns buracos novos de 3-4 px (uma 2ª passada acharia ~8 ícones). */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { acharBuracos } from "./lib/buracos.ts";

async function main() {
  const simular = process.argv.includes("--simular");
  const pasta = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "src/assets/icons";
  const arqs = readdirSync(pasta).filter((f) => f.endsWith(".webp") && !/^(frame|moldura|icf)/.test(f));
  let corrigidos = 0;
  for (const f of arqs) {
    const caminho = join(pasta, f);
    const { data, info } = await sharp(readFileSync(caminho)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = acharBuracos(data, info.width, info.height);
    if (!px.length) continue;
    corrigidos++;
    console.log(`${f}: ${px.length} px`);
    if (simular) continue;
    for (const i of px) data[i * 4 + 3] = 255;
    const saida = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .webp({ quality: 88 })
      .toBuffer();
    writeFileSync(caminho, saida);
  }
  console.log(`${simular ? "(simulação) " : ""}buracos corrigidos em ${corrigidos} de ${arqs.length} ícones`);
}

await main();
