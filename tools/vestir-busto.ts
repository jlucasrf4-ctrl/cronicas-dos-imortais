/** Gera peças exclusivas de cada busto integral e publica somente esses registros. */
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { decodificarAnim, type DadosAnim } from "../src/render/gl/esqueleto.ts";
import { elevarCos } from "./lib/elevar-cos.ts";
import { refinarPeitoral } from "./lib/refinar-peitoral.ts";
import { reduzirAnimado } from "./lib/reduzir-animado.ts";
import { orcamentoRoupa } from "./lib/orcamento-personagem.ts";
import { coberturaPorPeca } from "./lib/cobertura-roupa.ts";
import { Matrix4 } from "three";

interface RegistroRoupa {
  nome: string;
  rotulo: string;
  interno?: boolean;
  partes?: Partial<Record<"peito" | "pernas" | "pes", DadosAnim>>;
  anim?: DadosAnim;
}
const args = process.argv.slice(2);
const opcao = (n: string, d: string) => args.find((a) => a.startsWith("--" + n + "="))?.slice(n.length + 3) ?? d;
const corpo = opcao("corpo", "corpo_f02"),
  cabeca = opcao("cabeca", "busto_02"),
  par = corpo + "__" + cabeca;
const estilos = opcao("estilos", "aventureira,deserto,patrulheira,placa").split(",");
if (estilos.some((e) => !["aventureira", "deserto", "patrulheira", "placa"].includes(e)))
  throw Error("Estilo desconhecido");
const pacote = JSON.parse(readFileSync("build/modelos/busto_integral_" + par + ".json", "utf8")) as { anim: DadosAnim };
const corpoAnim = decodificarAnim(pacote.anim);
const alturaJunta = (nome:string) => new Matrix4().fromArray(pacote.anim.ibm[pacote.anim.juntas.indexOf(nome)]).invert().elements[13];
const deltaQuadril=alturaJunta("Hips")-23.904958859506312;
const deltaOmbro=(alturaJunta("LeftArm")+alturaJunta("RightArm"))/2-34.6;
const limites=orcamentoRoupa(par,{peito:1700,pernas:1800,pes:400});
const pasta = "build/modelos/bustos-integrais";
mkdirSync(pasta, { recursive: true });
const arqAnim = join(pasta, par + "_anim.json");
writeFileSync(arqAnim, JSON.stringify(pacote.anim));
const modelos: RegistroRoupa[] = [];
for (const estilo of estilos) {
  const plano = JSON.parse(readFileSync("tools/modelos/roupa_" + estilo + ".json", "utf8")) as {
    corpos: { nome: string; anim: string }[];
    pasta: string;
  };
  plano.corpos = [{ nome: par, anim: arqAnim }];
  plano.pasta = pasta;
  const arquivoPlano = join(pasta, par + "__" + estilo + "_plano.json");
  writeFileSync(arquivoPlano, JSON.stringify(plano, null, 2));
  const r = spawnSync(process.execPath, ["--max-old-space-size=6144", "tools/vestir-roupa.ts", arquivoPlano], {
    stdio: "inherit",
  });
  if (r.status !== 0) throw Error("Falha ao ajustar " + estilo);
  const partes: RegistroRoupa["partes"] = {};
  for (const parte of ["peito", "pernas", "pes"] as const) {
    const p = join(pasta, par + "__" + estilo + "_" + parte + "_anim.json");
    let anim = JSON.parse(readFileSync(p, "utf8")) as DadosAnim;
    if (parte === "pernas") {
      if (!anim.tex) throw Error("A roupa precisa do atlas para o cós");
      const meta = await sharp(Buffer.from(anim.tex.split(",")[1], "base64")).metadata();
      if (!meta.height) throw Error("Atlas sem altura");
      anim = elevarCos(anim, decodificarAnim(pacote.anim), {
        alturaBaixa: 24+deltaQuadril,
        alturaAlta: 28.4+deltaQuadril,
        folga: 0.14,
        cor: [0.27, 0.17, 0.115],
        branco: [0.5, (meta.height - 8) / meta.height],
      });
      writeFileSync(p, JSON.stringify(anim));
    }
    if (parte === "peito" && estilo === "aventureira") {
      anim = refinarPeitoral(anim, corpoAnim, {inicioY:32+deltaOmbro,plenoY:34+deltaOmbro,corpoMaxY:37+deltaOmbro,limiteAlcaY:35.6+deltaOmbro});
      writeFileSync(p, JSON.stringify(anim));
    }
    // Cós e alças acrescentam ou deslocam geometria depois da primeira redução.
    const antesReducao=anim;
    anim = await reduzirAnimado(anim,limites[parte]);
    if(anim!==antesReducao || parte==="pernas")
      anim.coberturaCorpo = coberturaPorPeca(corpoAnim,decodificarAnim(anim),1.8,parte==="pes");
    writeFileSync(p, JSON.stringify(anim));
    anim.clips = {};
    partes[parte] = anim;
  }
  modelos.push({
    nome: par + "__" + estilo,
    rotulo: "Busto integral " + corpo + " · " + cabeca + " · " + estilo,
    interno: true,
    partes,
  });
}
if (args.includes("--publicar")) {
  const destino = "src/assets/models/vestidos.json";
  const atual = JSON.parse(readFileSync(destino, "utf8")) as {
    modelos: RegistroRoupa[];
    texturas: Record<string, string>;
  };
  const backup = resolve("backups/busto-integral-roupas-2026-11-05");
  mkdirSync(backup, { recursive: true });
  if (!existsSync(join(backup, "vestidos.json"))) copyFileSync(destino, join(backup, "vestidos.json"));
  for (const modelo of modelos) {
    for (const [parte, anim] of Object.entries(modelo.partes ?? {})) {
      if (!anim?.tex) continue;
      const chave = par + "__" + modelo.nome.split("__").at(-1) + "__" + parte;
      atual.texturas[chave] = anim.tex;
      anim.texDe = chave;
      delete anim.tex;
    }
    atual.modelos = atual.modelos.filter((v) => v.nome !== modelo.nome);
    atual.modelos.push(modelo);
  }
  writeFileSync(destino, JSON.stringify(atual));
  console.log("Publicadas " + modelos.length + " roupas individuais de " + par);
}
