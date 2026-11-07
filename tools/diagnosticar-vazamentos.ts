/* 2026-11-06 — diagnóstico do corpo vazando pela roupa, com o mesmo código do jogo (aparencias.ts, cobertura-roupa.ts,
   esqueleto.ts). Para cada aparência sorteável × estilo de roupa × pose: a pele que sobra depois de ocultar a coberta
   é animada junto com as peças; um triângulo de pele "vaza" quando, andando para DENTRO do corpo pela normal dele, a
   reta encontra a roupa logo abaixo (a pele está por fora do tecido) sem outra camada de tecido por cima.
   Cabelo (máscara 2) e detalhes do rosto (3) não contam: cabelo por cima da roupa é o certo.
   Uso: node tools/diagnosticar-vazamentos.ts [--todas-cabecas]  →  build/personagens/vazamentos.json */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import {
  decodificarAnim,
  poseClip,
  matrizesPose,
  deformarMalha,
  type DadosAnim,
  type Anim,
} from "../src/render/gl/esqueleto.ts";
import {
  peleDaAparencia,
  cabeNoCorpo,
  cabecaDaAparencia,
  type AparenciasDados,
  type Aparencia,
} from "../src/render/gl/aparencias.ts";
import { assinaturaTriangulo } from "../src/render/gl/cobertura-roupa.ts";
import { grade, raio } from "./lib/raios-pose.ts";

type Modelo = { nome: string; anim?: DadosAnim; partes?: Partial<Record<"peito" | "pernas" | "pes", DadosAnim>> };
const pacote = JSON.parse(readFileSync("src/assets/models/vestidos.json", "utf8")) as { modelos: Modelo[] };
const aparencias = JSON.parse(readFileSync("src/assets/models/aparencias.json", "utf8")) as AparenciasDados;
const bustos = JSON.parse(readFileSync("src/assets/models/bustos-integrais.json", "utf8")) as NonNullable<
  Parameters<typeof peleDaAparencia>[2]
>["bustos"] & { combinacoes?: { corpo: string; cabeca: string; mascara: string }[] };
const heroinaDados = JSON.parse(readFileSync("src/assets/models/heroina_anim.json", "utf8")) as DadosAnim;
const clips = decodificarAnim(heroinaDados);
const todasCabecas = process.argv.includes("--todas-cabecas");

const porNome = (n: string) => pacote.modelos.find((v) => v.nome === n);
const bytes = (b64: string) => Uint8Array.from(Buffer.from(b64, "base64"));
const propria = (corpo: string) =>
  /^corpo_f0[1-6]$/.test(corpo)
    ? (porNome(corpo)?.anim ?? null)
    : corpo === "heroina"
      ? heroinaDados
      : (porNome(corpo === "lider" ? "lider_bandidos" : corpo)?.anim ?? null);

/** A mesma escolha de render/gl/vestidos.ts roupaDaAparencia (sem importar o renderer). */
function roupa(visual: Aparencia, estilo: string) {
  const corpo = visual.corpo === "heroina" || visual.corpo === "lider" ? "corpo_f01" : visual.corpo;
  if (!/^corpo_f0[1-6]$/.test(corpo)) return null;
  const esp = porNome(`${corpo}__${cabecaDaAparencia(visual, aparencias)}__${estilo}`);
  return { modelo: esp?.partes ? esp.nome : `${corpo}__${estilo}`, partes: (esp?.partes ? esp : porNome(`${corpo}__${estilo}`))?.partes };
}

/** A máscara por triângulo da pele montada (o mesmo caminho de peleDaAparencia); null se não der para saber. */
function mascaraDa(visual: Aparencia, nt: number): Uint8Array | null {
  const cab = cabecaDaAparencia(visual, aparencias),
    integral = bustos.combinacoes?.find((c) => c.corpo === visual.corpo && c.cabeca === cab);
  let m: Uint8Array | null = null;
  const corpo = aparencias.corpos?.find((c) => c.nome === visual.corpo),
    h = aparencias.cabecas?.find((c) => c.nome === cab);
  if (integral) m = bytes(integral.mascara);
  else if (visual.cabeca === "propria" && corpo?.mascaraPropria) m = bytes(corpo.mascaraPropria);
  else if (corpo?.mascara && h?.mascara) m = Uint8Array.from([...bytes(corpo.mascara), ...bytes(h.mascara)]);
  if (!m) return null;
  if (m.length === nt) return m;
  if (m.length < nt) {
    // a ponte do pescoço (unirPescoco) acrescenta triângulos de pele no fim
    const r = new Uint8Array(nt).fill(1);
    r.set(m);
    return r;
  }
  return null;
}

const POSES: [string, number][] = [
  ["parada", 0.5],
  ["andar", 0.15],
  ["andar", 0.5],
  ["correr", 0.2],
  ["espada_0", 0.2],
  ["espada_2", 0.3],
  ["arco_mirar", 0.3],
  ["coletar", 0.4],
  ["rolar", 0.25],
  ["escudo_parado", 0.3],
];
const REGIAO: Record<string, string> = {
  Hips: "quadril",
  Spine: "barriga",
  Spine1: "peito",
  Spine2: "peito",
  Neck: "pescoço",
  Head: "cabeça",
  LeftShoulder: "ombro",
  RightShoulder: "ombro",
  LeftArm: "braço",
  RightArm: "braço",
  LeftForeArm: "antebraço",
  RightForeArm: "antebraço",
  LeftHand: "mão",
  RightHand: "mão",
  LeftUpLeg: "coxa",
  RightUpLeg: "coxa",
  LeftLeg: "canela",
  RightLeg: "canela",
  LeftFoot: "pé",
  RightFoot: "pé",
};
const regiaoDe = (A: Anim, v: number) => {
  let j = 0,
    w = -1;
  for (let k = 0; k < 4; k++) {
    if (A.W[v * 4 + k] > w) {
      w = A.W[v * 4 + k];
      j = A.J[v * 4 + k];
    }
  }
  const nome = A.juntas[j].replace(/^mixamorig:?/, "");
  return REGIAO[nome] ?? nome;
};

const DENTRO = 1.6, // quanto abaixo da pele a roupa ainda conta (unidades do jogo; a personagem tem ~44)
  FORA = 2.5, // outra camada de tecido por cima até esta distância: coberta
  CEL = 1.2;
const visuais: Aparencia[] = [];
for (const c of aparencias.corpos ?? []) {
  if ((c.sexo ?? "f") !== "f" || c.nome.startsWith("deusa_")) continue;
  const cabecas = (aparencias.cabecas ?? []).filter((h) => cabeNoCorpo(c, h)).map((h) => h.nome);
  const integrais = new Set(bustos.combinacoes?.filter((v) => v.corpo === c.nome).map((v) => v.cabeca));
  const escolha = todasCabecas ? cabecas : cabecas.filter((h) => integrais.has(h)).concat("busto_10");
  visuais.push({ corpo: c.nome, cabeca: "propria" });
  for (const h of new Set(escolha)) if (h !== c.cabecaPadrao) visuais.push({ corpo: c.nome, cabeca: h });
}

const linhas: {
  corpo: string;
  cabeca: string;
  estilo: string;
  roupa: string;
  pose: string;
  vazados: number;
  area: number;
  regioes: Record<string, number>;
}[] = [];
const avisos: string[] = [];
const ESTILOS = ["aventureira", "deserto", "patrulheira", "placa"];
const inicio = Date.now();
for (const visual of visuais) {
  // a Heroína com a cabeça própria e sem cor trocada é o modelo dela mesmo (peleDaAparencia devolve null)
  const peleD =
    peleDaAparencia(visual, propria, { aparencias, bustos }) ??
    (visual.corpo === "heroina" && visual.cabeca === "propria" ? heroinaDados : null);
  if (!peleD) {
    avisos.push(`${visual.corpo}/${visual.cabeca}: sem pele`);
    continue;
  }
  const pele = "ini" in peleD ? peleD : decodificarAnim(peleD),
    ntPele = pele.I.length / 3,
    mascara = mascaraDa(visual, ntPele);
  if (!mascara) avisos.push(`${visual.corpo}/${visual.cabeca}: máscara não confere (${ntPele} triângulos)`);
  for (const estilo of ESTILOS) {
    const r = roupa(visual, estilo);
    if (!r?.partes) {
      avisos.push(`${visual.corpo}/${visual.cabeca}/${estilo}: sem roupa`);
      continue;
    }
    const partes = [r.partes.peito, r.partes.pernas, r.partes.pes].filter((p): p is DadosAnim => !!p);
    // a pele coberta some (como ocultarPeleCoberta), guardando o índice original para a máscara
    const cobertas = new Set<string>();
    for (const d of partes) {
      if (!d.coberturaCorpo) continue;
      const q = new Int16Array(bytes(d.coberturaCorpo).buffer);
      for (let i = 0; i < q.length; i += 9) cobertas.add(assinaturaTriangulo(q.subarray(i, i + 9), [0, 1, 2], 0, 1));
    }
    const fica: number[] = [];
    let ocultos = 0;
    for (let t = 0; t < ntPele; t++) {
      if (cobertas.has(assinaturaTriangulo(pele.P, pele.I, t))) ocultos++;
      else if (!mascara || mascara[t] === 0 || mascara[t] === 1) fica.push(t);
    }
    if (!ocultos) avisos.push(`${visual.corpo}/${visual.cabeca}/${estilo}: a cobertura não escondeu nenhum triângulo (${r.modelo})`);
    const panos = partes.map((d) => decodificarAnim(d));
    for (const [clip, t0] of POSES) {
      if (!clips.clips[clip]) continue;
      const pose = poseClip(clips, clip, t0, true);
      const dp = deformarMalha(pele, matrizesPose(pele, pose));
      const pp = panos.map((A) => deformarMalha(A, matrizesPose(A, pose)).p),
        tot = pp.reduce((s, p) => s + p.length, 0),
        P = new Float32Array(tot);
      let o = 0;
      for (const p of pp) {
        P.set(p, o);
        o += p.length;
      }
      const g = grade(P, CEL);
      let vazados = 0,
        area = 0;
      const regioes: Record<string, number> = {};
      for (const t of fica) {
        const a = t * 9,
          c = [0, 1, 2].map((e) => (dp.p[a + e] + dp.p[a + 3 + e] + dp.p[a + 6 + e]) / 3),
          n = [dp.n[a], dp.n[a + 1], dp.n[a + 2]],
          baixo = raio(P, g, CEL, c, [-n[0], -n[1], -n[2]], DENTRO);
        if (baixo === Infinity) continue;
        if (raio(P, g, CEL, c, n, FORA) !== Infinity) continue;
        const e1 = [0, 1, 2].map((e) => dp.p[a + 3 + e] - dp.p[a + e]),
          e2 = [0, 1, 2].map((e) => dp.p[a + 6 + e] - dp.p[a + e]),
          ar =
            0.5 *
            Math.hypot(
              e1[1] * e2[2] - e1[2] * e2[1],
              e1[2] * e2[0] - e1[0] * e2[2],
              e1[0] * e2[1] - e1[1] * e2[0],
            );
        vazados++;
        area += ar;
        const reg = regiaoDe(pele, pele.I[t * 3]);
        regioes[reg] = +((regioes[reg] ?? 0) + ar).toFixed(2);
      }
      linhas.push({
        corpo: visual.corpo,
        cabeca: visual.cabeca,
        estilo,
        roupa: r.modelo,
        pose: clip + "@" + t0,
        vazados,
        area: +area.toFixed(2),
        regioes,
      });
    }
  }
  process.stdout.write(".");
}
console.log(`\n${linhas.length} quadros em ${((Date.now() - inicio) / 1000).toFixed(0)} s`);

/* resumo: por aparência+estilo (a pior pose e a média), por corpo, por estilo, por pose e por região */
const somar = <K extends string>(chave: (l: (typeof linhas)[number]) => K) => {
  const m = new Map<K, { area: number; n: number; max: number }>();
  for (const l of linhas) {
    const k = chave(l),
      v = m.get(k) ?? { area: 0, n: 0, max: 0 };
    v.area += l.area;
    v.n++;
    v.max = Math.max(v.max, l.area);
    m.set(k, v);
  }
  return [...m.entries()]
    .map(([k, v]) => ({ chave: k, media: +(v.area / v.n).toFixed(2), pior: +v.max.toFixed(2) }))
    .sort((a, b) => b.media - a.media);
};
const regioes = new Map<string, number>();
for (const l of linhas) for (const [k, v] of Object.entries(l.regioes)) regioes.set(k, (regioes.get(k) ?? 0) + v);
const resumo = {
  porCombinacao: somar((l) => `${l.corpo}/${l.cabeca}/${l.estilo}`).slice(0, 40),
  porCorpo: somar((l) => l.corpo),
  porEstilo: somar((l) => l.estilo),
  porPose: somar((l) => l.pose),
  porRegiao: [...regioes.entries()].map(([k, v]) => ({ regiao: k, area: +v.toFixed(1) })).sort((a, b) => b.area - a.area),
  avisos,
};
mkdirSync("build/personagens", { recursive: true });
writeFileSync("build/personagens/vazamentos.json", JSON.stringify({ resumo, linhas }, null, 1));
console.log(JSON.stringify(resumo, null, 1));
