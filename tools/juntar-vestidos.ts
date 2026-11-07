/* v8.0 — junta as malhas dos personagens vestidos no esqueleto da heroína (build/modelos/<nome>_anim.json, de
   tools/gerar-animacoes.ts com "vestir") num JSON do jogo, src/assets/models/vestidos.json, lido por
   src/render/gl/vestidos.ts (a sala de treino: manequins e o E que troca a aparência da heroína).
   Sem os clips: a pose vem dos clips da heroína (mesmo esqueleto), só a malha, as juntas de repouso e as inversas de
   bind de cada um entram. Uso:  node tools/juntar-vestidos.ts      (lista e rótulos em VESTIDOS, abaixo) */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { estabilizarBusto } from "./lib/pesos-tronco.ts";
import { refinarOmbrosModelo } from "./lib/refinar-ombros.ts";

/** nome do plano → rótulo no jogo, na ordem da fila de manequins */
const VESTIDOS: [string, string][] = [
  ["lider_bandidos", "Líder dos bandidos"],
  ["bandido_capuz", "Bandido encapuzado"],
  ["bandido_colete", "Bandido de colete"],
  ["bandido_bruto", "Bandido bruto"],
  ["bandido_couraca", "Bandido de couraça"],
  ["samurai", "Samurai"],
  ["cavaleiro_1", "Cavaleiro I"],
  ["cavaleiro_2", "Cavaleiro II"],
  ["cavaleiro_3", "Cavaleiro III"],
  ["cavaleiro_4", "Cavaleiro IV"],
  // as 4 deusas (build/tmp/deusas_proj.ts --exportar: corpo novo + cabeça do Tripo, pele, tatuagens): GameShark
  // PRIMAVERA/VERAO/OUTONO/INVERNO (ui/gameshark.ts)
  ["deusa_primavera", "Deusa da Primavera"],
  ["deusa_verao", "Deusa do Verão"],
  ["deusa_outono", "Deusa do Outono"],
  ["deusa_outono_nova", "Deusa do Outono (modelo novo)"],
  ["deusa_inverno", "Deusa do Inverno"],
  // o explorador da folha dos aventureiros (a do caçador), sem a mochila: npm run tools:explorador
  ["explorador", "Explorador"],
  ...Array.from({ length: 12 }, (_, k): [string, string] => [`aldeao_${k + 1}`, `Aldeão ${k + 1}`]),
  ["guarda_nova", "Guarda de armadura branca"],
  // v8.1 — os corpos novos do Tripo (arquivos de transferência/corpos_tripo): a cabeça própria deles nas aparências
  // vem daqui (vestidos.ts peleDoVisual, pelo nome do corpo)
  ["corpo_f02", "Atlética (F02)"],
  ["corpo_f04", "Delicada (F04)"],
  ["corpo_f05", "Natural (F05)"],
  ["corpo_f06", "Voluptuosa (F06)"],
  ["corpo_f01", "Esbelta (F01)"],
  ["corpo_f03", "Curvilínea (F03)"],
  ["corpo_m01", "Esbelto (M01)"],
  ["corpo_m04", "Alto e magro (M04)"],
  ["corpo_m06", "Musculoso (M06)"],
  // v8.1 — roupas vestidas por cima dos corpos (tools/vestir-roupa.ts), para testar na sala de treino
  ["corpo_f01__aventureira", "Esbelta de aventureira"],
  ["corpo_f02__aventureira", "Atlética de aventureira"],
  ["corpo_f03__aventureira", "Curvilínea de aventureira"],
  ["corpo_f04__aventureira", "Delicada de aventureira"],
  ["corpo_f05__aventureira", "Natural de aventureira"],
  ["corpo_f06__aventureira", "Voluptuosa de aventureira"],
  ["corpo_f01__placa", "Esbelta de placa"],
  ["corpo_f02__placa", "Atlética de placa"],
  ["corpo_f03__placa", "Curvilínea de placa"],
  ["corpo_f04__placa", "Delicada de placa"],
  ["corpo_f05__placa", "Natural de placa"],
  ["corpo_f06__placa", "Voluptuosa de placa"],
  ["corpo_f01__deserto", "Esbelta do deserto"],
  ["corpo_f02__deserto", "Atlética do deserto"],
  ["corpo_f03__deserto", "Curvilínea do deserto"],
  ["corpo_f04__deserto", "Delicada do deserto"],
  ["corpo_f05__deserto", "Natural do deserto"],
  ["corpo_f06__deserto", "Voluptuosa do deserto"],
  ["corpo_f01__patrulheira", "Esbelta patrulheira"],
  ["corpo_f02__patrulheira", "Atlética patrulheira"],
  ["corpo_f03__patrulheira", "Curvilínea patrulheira"],
  ["corpo_f04__patrulheira", "Delicada patrulheira"],
  ["corpo_f05__patrulheira", "Natural patrulheira"],
  ["corpo_f06__patrulheira", "Voluptuosa patrulheira"],
];
const SAIDA = "src/assets/models/vestidos.json";

const modelos = VESTIDOS.map(([nome, rotulo]) => {
  const d = JSON.parse(readFileSync(`build/modelos/${nome}_anim.json`, "utf8"));
  d.clips = {};
  const recrutaPadrao = /^corpo_f0[1-6](?:__aventureira)?$/.test(nome);
  const busto = recrutaPadrao ? estabilizarBusto(d) : null;
  refinarOmbrosModelo(nome, d);
  const partes: Record<string, unknown> = {};
  for (const parte of ["peito", "pernas", "pes"]) {
    const arq = `build/modelos/${nome}_${parte}_anim.json`;
    if (!existsSync(arq)) continue;
    const p = JSON.parse(readFileSync(arq, "utf8"));
    p.clips = {};
    if (recrutaPadrao && busto) estabilizarBusto(p, busto.faixa);
    refinarOmbrosModelo(nome, p);
    partes[parte] = p;
  }
  // v8.0: textura de verdade (build/tmp/deusas_proj.ts --textura): as coordenadas por canto de triângulo, na ordem
  // do .glb da pose T (a mesma do _anim.json), e a imagem; a cor por face vira branco (o shader multiplica)
  const base = `build/modelos/${nome}_tpose/${nome}_tpose`;
  if (!d.tex && existsSync(base + "_uv.bin") && existsSync(base + "_tex.webp")) {
    const b = readFileSync(base + "_uv.bin"),
      uv = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4),
      nt = Buffer.from(d.malha.i, "base64").length / 6;
    if (uv.length !== nt * 6) throw new Error(`${nome}: ${uv.length / 6} UVs para ${nt} triângulos`);
    const u16 = Uint16Array.from(uv, (v) => Math.round(Math.min(1, Math.max(0, v)) * 65535));
    d.malha.uv = Buffer.from(u16.buffer).toString("base64");
    d.malha.c = Buffer.alloc(nt * 3, 255).toString("base64");
    d.tex = "data:image/webp;base64," + readFileSync(base + "_tex.webp").toString("base64");
    console.log(`${nome}: textura ${(d.tex.length / 1024).toFixed(0)} KB`);
  }
  // As variações internas só servem de fonte para as peças equipadas; não precisam duplicar o corpo completo no jogo.
  const roupaInterna = /^corpo_f0[1-6]__(deserto|patrulheira|placa)$/.test(nome);
  if (busto?.alterados) console.log(`${nome}: busto estabilizado em ${busto.alterados} vértices`);
  return roupaInterna ? { nome, rotulo, partes } : { nome, rotulo, anim: d, partes };
});
// Peças preparadas individualmente para os bustos completos; nunca viram manequins extras.
const arquivoIntegrais = "src/assets/models/bustos-integrais.json";
const roupasIntegrais: { nome: string; rotulo: string; interno: boolean; anim?: undefined; partes: Record<string, unknown> }[] = [];
if (existsSync(arquivoIntegrais)) {
  const pares = JSON.parse(readFileSync(arquivoIntegrais, "utf8")) as { combinacoes?: { corpo: string; cabeca: string }[] };
  for (const par of pares.combinacoes ?? []) for (const estilo of ["aventureira", "deserto", "patrulheira", "placa"]) {
    const nome = par.corpo + "__" + par.cabeca + "__" + estilo;
    const partes: Record<string, unknown> = {};
    for (const parte of ["peito", "pernas", "pes"]) {
      const arq = "build/modelos/bustos-integrais/" + nome + "_" + parte + "_anim.json";
      if (existsSync(arq)) partes[parte] = JSON.parse(readFileSync(arq, "utf8"));
    }
    if (Object.keys(partes).length === 3) roupasIntegrais.push({ nome, rotulo: nome, interno: true, partes });
  }
}
const proprios = [
  ["quimera", "Quimera"],
  ["grifo", "Grifo"],
  ["hidra", "Hidra de cinco cabeças"],
].map(([nome, rotulo]) => ({
  nome,
  rotulo,
  proprio: true,
  anim: JSON.parse(readFileSync(`build/modelos/${nome}_anim.json`, "utf8")),
}));
const texturas: Record<string, string> = {},
  porImagem = new Map<string, string>();
for (const v of [...modelos, ...roupasIntegrais, ...proprios])
  for (const d of [v.anim, ...("partes" in v ? Object.values(v.partes) : [])]) {
    if (!d?.tex) continue;
    let chave = porImagem.get(d.tex);
    if (!chave) {
      chave = "textura_" + porImagem.size;
      porImagem.set(d.tex, chave);
      texturas[chave] = d.tex;
    }
    d.texDe = chave;
    delete d.tex;
  }
const json = JSON.stringify({ modelos: [...modelos, ...roupasIntegrais, ...proprios], texturas });
writeFileSync(SAIDA, json);
console.log(`${SAIDA}: ${(json.length / 1024).toFixed(0)} KB, ${modelos.length + proprios.length} modelos e variações`);
