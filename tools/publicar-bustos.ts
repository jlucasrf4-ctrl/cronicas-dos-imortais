/** Confere todas as montagens e roupas prontas antes de atualizar os dados usados pelo jogo. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { ORCAMENTO_PERSONAGEM } from "./lib/orcamento-personagem.ts";
import type { DadosAnim } from "../src/render/gl/esqueleto.ts";
type Roupa = {
  nome: string;
  rotulo: string;
  interno?: boolean;
  partes?: Partial<Record<"peito" | "pernas" | "pes", DadosAnim>>;
};
type Busto = {
  corpo: string;
  cabeca: string;
  anim: DadosAnim;
  relatorio: {
    problemas: string[];
    contornos: { componentes: number; verticesAbertos: number; verticesNaoManifold: number }[];
  };
};
const plano = JSON.parse(readFileSync("tools/modelos/bustos-integrais.json", "utf8")) as {
  combinacoes: { corpo: string; cabeca: string }[];
};
const vestidos = JSON.parse(readFileSync("src/assets/models/vestidos.json", "utf8")) as {
  modelos: Roupa[];
  texturas: Record<string, string>;
};
const bustos = JSON.parse(readFileSync("src/assets/models/bustos-integrais.json", "utf8")) as {
  combinacoes: Busto[];
  texturas?: Record<string, string>;
};
const preparados: { busto: Busto; roupas: Roupa[] }[] = [],
  relatorio: object[] = [];
const identidades = new Set<string>();
for (const par of plano.combinacoes) {
  const chave = par.corpo + "__" + par.cabeca;
  if (identidades.has(chave)) throw Error("Combinação repetida: " + chave);
  identidades.add(chave);
  const busto = JSON.parse(readFileSync(`build/modelos/busto_integral_${chave}.json`, "utf8")) as Busto;
  if (
    busto.relatorio.problemas.length ||
    busto.relatorio.contornos.length !== 6 ||
    busto.relatorio.contornos.some((c) => c.componentes !== 1 || c.verticesAbertos || c.verticesNaoManifold)
  )
    throw Error("Encaixe inválido: " + chave);
  const roupas: Roupa[] = [],
    max = { peito: 0, pernas: 0, pes: 0 };
  for (const estilo of ["aventureira", "deserto", "patrulheira", "placa"]) {
    const partes: NonNullable<Roupa["partes"]> = {};
    for (const parte of ["peito", "pernas", "pes"] as const) {
      const anim = JSON.parse(
        readFileSync(`build/modelos/bustos-integrais/${chave}__${estilo}_${parte}_anim.json`, "utf8"),
      ) as DadosAnim;
      for (const campo of ["juntas", "pais", "ibm", "repouso", "raiz"] as const)
        if (JSON.stringify(anim[campo]) !== JSON.stringify(busto.anim[campo]))
          throw Error(`Rig diferente em ${chave}/${estilo}/${parte}/${campo}`);
      const tris = Buffer.from(anim.malha.i, "base64").length / 6;
      if (!Number.isInteger(tris) || !anim.coberturaCorpo) throw Error("Peça incompleta: " + chave + "/" + parte);
      max[parte] = Math.max(max[parte], tris);
      anim.clips = {};
      partes[parte] = anim;
    }
    roupas.push({
      nome: chave + "__" + estilo,
      rotulo: `Busto integral ${par.corpo} · ${par.cabeca} · ${estilo}`,
      interno: true,
      partes,
    });
  }
  const pele = Buffer.from(busto.anim.malha.i, "base64").length / 6,
    total = pele + max.peito + max.pernas + max.pes + ORCAMENTO_PERSONAGEM.equipamentos;
  if (total > ORCAMENTO_PERSONAGEM.total) throw Error(`${chave}: ${total} triângulos excedem o orçamento completo`);
  preparados.push({ busto, roupas });
  relatorio.push({ combinacao: chave, pele, roupas: max, total });
}
console.log(JSON.stringify(relatorio, null, 2));
if (process.argv.includes("--publicar")) {
  const registrar = (anim: DadosAnim, texturas: Record<string, string>) => {
    if (!anim.tex) return;
    const existente = Object.entries(texturas).find(([, t]) => t === anim.tex)?.[0];
    const chave = existente ?? "busto_" + createHash("sha256").update(anim.tex).digest("hex").slice(0, 16);
    texturas[chave] = anim.tex;
    anim.texDe = chave;
    delete anim.tex;
  };
  bustos.texturas ??= {};
  vestidos.texturas ??= {};
  for (const { busto, roupas } of preparados) {
    registrar(busto.anim, bustos.texturas);
    bustos.combinacoes = bustos.combinacoes.filter((b) => b.corpo !== busto.corpo || b.cabeca !== busto.cabeca);
    bustos.combinacoes.push(busto);
    for (const roupa of roupas) {
      for (const anim of Object.values(roupa.partes ?? {})) registrar(anim, vestidos.texturas);
      vestidos.modelos = vestidos.modelos.filter((v) => v.nome !== roupa.nome);
      vestidos.modelos.push(roupa);
    }
  }
  writeFileSync("src/assets/models/bustos-integrais.json", JSON.stringify(bustos));
  writeFileSync("src/assets/models/vestidos.json", JSON.stringify(vestidos));
  console.log(`${preparados.length} montagens e ${preparados.length * 4} roupas atualizadas.`);
}
