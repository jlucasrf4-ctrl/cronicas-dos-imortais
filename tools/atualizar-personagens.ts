/* v8.1 — reconstrução sequencial dos personagens, com orçamento reservado para roupa e equipamento. */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ORCAMENTO_PERSONAGEM } from "./lib/orcamento-personagem.ts";

const pasta = "tools/modelos";
const ler = (n: string) => JSON.parse(readFileSync(join(pasta, n + ".json"), "utf8"));
const gravar = (n: string, d: object) => writeFileSync(join(pasta, n + ".json"), JSON.stringify(d, null, 2) + "\n");
const rodar = (arq: string, ...args: string[]) =>
  execFileSync(process.execPath, ["--max-old-space-size=6144", arq, ...args], { stdio: "inherit" });
const corpos = [
  "corpo_f01",
  "corpo_f02",
  "corpo_f03",
  "corpo_f04",
  "corpo_f05",
  "corpo_f06",
  "corpo_m01",
  "corpo_m04",
  "corpo_m06",
];
const guerreiros = [
  "samurai",
  "cavaleiro_1",
  "cavaleiro_2",
  "cavaleiro_3",
  "cavaleiro_4",
  "bandido_capuz",
  "bandido_colete",
  "bandido_bruto",
  "bandido_couraca",
  "explorador",
];
for (const nome of [...corpos, ...guerreiros]) {
  const p = ler(nome);
  p.triangulos = ORCAMENTO_PERSONAGEM.corpo;
  p.cabeca = { y: p.cabeca?.y ?? 0.84, triangulos: ORCAMENTO_PERSONAGEM.rostoCorpo };
  p.texturaSaida = 1536;
  gravar(nome, p);
}
const folhas = [
  "medieval character 3d model.glb",
  "medieval fantasy character 3d model.glb",
  "medieval peasant 3d model.glb",
];
const registro = JSON.parse(readFileSync("build/inspecao-personagens/folhas.json", "utf8")) as {
  nome: string;
  caixa: { mn: number[]; mx: number[] };
}[];
const novos: string[] = [];
for (let f = 0; f < folhas.length; f++) {
  const caixa = registro.find((r) => r.nome === folhas[f])!.caixa;
  const meioY = (caixa.mn[1] + caixa.mx[1]) / 2;
  for (let k = 0; k < 4; k++) {
    const nome = `aldeao_${f * 4 + k + 1}`;
    novos.push(nome);
    gravar(nome, {
      nome,
      glb: "arquivos de transferência/3.11.2026/" + folhas[f],
      regiao: { ...(k % 2 ? { xMin: 0 } : { xMax: 0 }), ...(k < 2 ? { yMin: meioY } : { yMax: meioY }) },
      altura: 1.7,
      triangulos: ORCAMENTO_PERSONAGEM.corpo,
      cabeca: { y: 0.84, triangulos: ORCAMENTO_PERSONAGEM.rostoCorpo },
      texturaSaida: 1536,
      texW: 2048,
      cor: [0.98, 1, 1.06],
      pasta: `build/modelos/${nome}_tpose`,
    });
    const a = ler("explorador_animacoes");
    a.vestir = `build/modelos/${nome}_tpose/${nome}_tpose.glb`;
    a.saida = `build/modelos/${nome}_anim.json`;
    a.previas = `build/modelos/${nome}_anim`;
    a.ombroMedido = true;
    a.panoEntrePernas = k % 2 === 1;
    gravar(nome + "_animacoes", a);
  }
}
gravar("guarda_nova", {
  nome: "guarda_nova",
  glb: "arquivos de transferência/3.11.2026/medieval armor character 3d model.glb",
  altura: 1.7,
  triangulos: ORCAMENTO_PERSONAGEM.corpo,
  cabeca: { y: 0.84, triangulos: ORCAMENTO_PERSONAGEM.rostoCorpo },
  texturaSaida: 1536,
  texW: 2048,
  pasta: "build/modelos/guarda_nova_tpose",
});
const guarda = ler("explorador_animacoes");
Object.assign(guarda, {
  vestir: "build/modelos/guarda_nova_tpose/guarda_nova_tpose.glb",
  saida: "build/modelos/guarda_nova_anim.json",
  previas: "build/modelos/guarda_nova_anim",
  ombroMedido: true,
  panoEntrePernas: true,
});
gravar("guarda_nova_animacoes", guarda);
const nomes = [...corpos, ...guerreiros, ...novos, "guarda_nova"];
mkdirSync("build/personagens", { recursive: true });
const concluidos: string[] =
  process.argv.includes("--retomar") && existsSync("build/personagens/progresso.json")
    ? JSON.parse(readFileSync("build/personagens/progresso.json", "utf8")).concluidos
    : [];
for (const nome of nomes) {
  if (concluidos.includes(nome)) continue;
  console.log(`\nPERSONAGEM: ${nome}`);
  const p = ler(nome);
  rodar(p.referencia && !p.texW ? "tools/pintar-modelo.ts" : "tools/reduzir-modelo.ts", join(pasta, nome + ".json"));
  rodar("tools/gerar-animacoes.ts", join(pasta, nome + "_animacoes.json"));
  concluidos.push(nome);
  writeFileSync("build/personagens/progresso.json", JSON.stringify({ concluidos, total: nomes.length }, null, 2));
}
if (!process.argv.includes("--sem-roupas")) {
  rodar("tools/gerar-aparencias.ts", "--corpos");
  for (const roupa of ["aventureira", "deserto", "patrulheira", "placa"]) {
    if (existsSync(join(pasta, `roupa_${roupa}.json`)))
      rodar("tools/vestir-roupa.ts", join(pasta, `roupa_${roupa}.json`));
  }
}
console.log("Reconstrução concluída. Empacotar com tools/juntar-vestidos.ts após a revisão.");
