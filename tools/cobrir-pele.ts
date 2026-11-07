/* 2026-11-06 — a pele coberta de cada peça de roupa, calculada contra TODAS as malhas de corpo que vestem a peça no
   jogo (render/gl/vestidos.ts roupaDaAparencia + cobertura-roupa.ts ocultarPeleCoberta):
   - roupa-base <corpo>__<estilo>: o corpo completo do manequim (vestidos.json), o corpo sem cabeça das aparências
     (cabeças trocadas) e, no F1, também a Heroína e a Líder (que vestem a roupa do F1);
   - roupa de busto montado <corpo>__<cabeca>__<estilo>: a malha do busto (bustos-integrais.json).
   A cobertura é a união das assinaturas (posições ×64) — cada malha só reconhece os próprios triângulos. Antes, as
   roupas-base (fora a aventureira do F2) não tinham cobertura nenhuma: o corpo inteiro ficava por baixo do tecido e
   atravessava ao se mexer (tools/diagnosticar-vazamentos.ts). Grava em vestidos.json e nas peças de build/modelos
   (para sobreviver a um novo tools/juntar-vestidos.ts).
   Uso: node tools/cobrir-pele.ts [--folga 1.0] [--poses]
     --folga: multiplica a distância de busca (0,04 × altura do corpo) da cobertura na pose de repouso;
     --poses: também esconde a pele que, em TODAS as poses de POSES, tem tecido logo acima (coberta) ou logo abaixo
       (atravessando): é a pele que escapa pelo tecido ao dobrar o corpo; um trecho exposto em alguma pose nunca some
       (senão abriria buraco). Só pele e "outro" da máscara (nunca cabelo nem rosto). */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { decodificarAnim, poseClip, matrizesPose, deformarMalha, type DadosAnim, type Anim } from "../src/render/gl/esqueleto.ts";
import { assinaturaTriangulo } from "../src/render/gl/cobertura-roupa.ts";
import { coberturaPorPeca } from "./lib/cobertura-roupa.ts";
import { grade, raio } from "./lib/raios-pose.ts";

type Parte = "peito" | "pernas" | "pes";
type Modelo = { nome: string; anim?: DadosAnim; interno?: boolean; partes?: Partial<Record<Parte, DadosAnim>> };
const ARQ = "src/assets/models/vestidos.json";
const pacote = JSON.parse(readFileSync(ARQ, "utf8")) as { modelos: Modelo[]; texturas?: Record<string, string> };
const aparencias = JSON.parse(readFileSync("src/assets/models/aparencias.json", "utf8")) as {
  corpos: { nome: string; semCabeca: DadosAnim; mascara?: string; mascaraPropria?: string }[];
};
const bustos = JSON.parse(readFileSync("src/assets/models/bustos-integrais.json", "utf8")) as {
  combinacoes?: { corpo: string; cabeca: string; anim: DadosAnim; mascara: string }[];
};
const heroina = JSON.parse(readFileSync("src/assets/models/heroina_anim.json", "utf8")) as DadosAnim;
const i = process.argv.indexOf("--folga"),
  folga = i > 0 ? Number(process.argv[i + 1]) : 1,
  comPoses = process.argv.includes("--poses");
const clips = decodificarAnim(heroina);

const porNome = (n: string) => pacote.modelos.find((m) => m.nome === n);
const corpoAp = (n: string) => aparencias.corpos.find((c) => c.nome === n);
const semCabeca = (n: string) => corpoAp(n)?.semCabeca;
const b64 = (s?: string) => (s ? Uint8Array.from(Buffer.from(s, "base64")) : null);
/** a máscara (por triângulo) de cada malha de pele, para não esconder cabelo nem rosto */
const MASCARAS = new Map<DadosAnim, Uint8Array | null>();

/** As poses em que a pele precisa estar junto ao tecido para sumir (as mesmas do diagnóstico). */
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
const DENTRO = 1.6, // tecido até aqui abaixo da pele: ela está atravessando
  FORA = 2.5, // tecido até aqui acima da pele: coberta
  CEL = 1.2;
/** Triângulos da pele (índices) junto ao tecido da peça em todas as poses; a amostra é o centro e os três cantos
 *  puxados 15% para o centro (o canto exato na borda do tecido errava para os dois lados). */
function juntoAoTecido(pele: Anim, mascara: Uint8Array | null, roupa: Anim) {
  const nt = pele.I.length / 3;
  if (!mascara || mascara.length !== nt) return null;
  let vivos: number[] = [];
  for (let t = 0; t < nt; t++) if (mascara[t] === 0 || mascara[t] === 1) vivos.push(t);
  for (const [clip, t0] of POSES) {
    if (!vivos.length) break;
    const pose = poseClip(clips, clip, t0, true),
      dp = deformarMalha(pele, matrizesPose(pele, pose)),
      pr = deformarMalha(roupa, matrizesPose(roupa, pose)).p,
      g = grade(pr, CEL);
    const ficam: number[] = [];
    for (const t of vivos) {
      const a = t * 9,
        n = [dp.n[a], dp.n[a + 1], dp.n[a + 2]],
        m = [-n[0], -n[1], -n[2]],
        c = [0, 1, 2].map((e) => (dp.p[a + e] + dp.p[a + 3 + e] + dp.p[a + 6 + e]) / 3);
      const amostras = [c, ...[0, 1, 2].map((k) => [0, 1, 2].map((e) => dp.p[a + k * 3 + e] * 0.85 + c[e] * 0.15))];
      if (amostras.every((o) => raio(pr, g, CEL, o, n, FORA) !== Infinity || raio(pr, g, CEL, o, m, DENTRO) !== Infinity))
        ficam.push(t);
    }
    vivos = ficam;
  }
  return vivos;
}
const cache = new Map<DadosAnim, Anim>();
const dec = (d: DadosAnim) => {
  let A = cache.get(d);
  if (!A) cache.set(d, (A = decodificarAnim(d)));
  return A;
};
const altura = (A: Anim) => {
  let y = 0;
  for (let v = 1; v < A.P.length; v += 3) y = Math.max(y, A.P[v]);
  return y;
};

/** As malhas de pele que vestem a peça <nome> no jogo. */
function peles(nome: string): [string, DadosAnim][] {
  const m3 = /^(corpo_f0[1-6])__([^_].*?)__(aventureira|deserto|patrulheira|placa)$/.exec(nome);
  if (m3) {
    const c = bustos.combinacoes?.find((v) => v.corpo === m3[1] && v.cabeca === m3[2]);
    if (c) MASCARAS.set(c.anim, b64(c.mascara));
    return c ? [[`${m3[1]}/${m3[2]} (busto)`, c.anim]] : [];
  }
  const m2 = /^(corpo_f0[1-6])__(aventureira|deserto|patrulheira|placa)$/.exec(nome);
  if (!m2) return [];
  const corpo = m2[1],
    lista: [string, DadosAnim | undefined, string | undefined][] = [
      [corpo, porNome(corpo)?.anim, corpoAp(corpo)?.mascaraPropria],
      [corpo + " sem cabeça", semCabeca(corpo), corpoAp(corpo)?.mascara],
    ];
  if (corpo === "corpo_f01")
    lista.push(
      ["heroina", heroina, corpoAp("heroina")?.mascaraPropria],
      ["heroina sem cabeça", semCabeca("heroina"), corpoAp("heroina")?.mascara],
      ["lider", porNome("lider_bandidos")?.anim, corpoAp("lider")?.mascaraPropria],
      ["lider sem cabeça", semCabeca("lider"), corpoAp("lider")?.mascara],
    );
  for (const [, d, m] of lista) if (d) MASCARAS.set(d, b64(m));
  return lista.filter((v) => !!v[1]).map(([r, d]) => [r, d!]);
}

let mudou = 0;
for (const m of pacote.modelos) {
  if (!m.partes) continue;
  const fontes = peles(m.nome);
  if (!fontes.length) continue;
  for (const parte of ["peito", "pernas", "pes"] as Parte[]) {
    const d = m.partes[parte];
    if (!d) continue;
    const roupa = dec(d),
      vistas = new Set<string>(),
      saida: number[] = [];
    const contagem: string[] = [];
    // soma com a cobertura que a peça já tinha (feita na geração dela): nunca devolve pele que já estava escondida
    if (d.coberturaCorpo) {
      const q = new Int16Array(Buffer.from(d.coberturaCorpo, "base64").buffer);
      for (let k = 0; k < q.length; k += 9) {
        const s = assinaturaTriangulo(q.subarray(k, k + 9), [0, 1, 2], 0, 1);
        if (vistas.has(s)) continue;
        vistas.add(s);
        for (let e = 0; e < 9; e++) saida.push(q[k + e]);
      }
      contagem.push(`anterior ${saida.length / 9}`);
    }
    for (const [rotulo, pd] of fontes) {
      const A = dec(pd),
        cob = coberturaPorPeca(A, roupa, altura(A) * 0.04 * folga, parte === "pes"),
        q = new Int16Array(Buffer.from(cob, "base64").buffer);
      let n = 0;
      for (let k = 0; k < q.length; k += 9) {
        const s = assinaturaTriangulo(q.subarray(k, k + 9), [0, 1, 2], 0, 1);
        if (vistas.has(s)) continue;
        vistas.add(s);
        n++;
        for (let e = 0; e < 9; e++) saida.push(q[k + e]);
      }
      contagem.push(`${rotulo} ${n}`);
      if (!comPoses) continue;
      const nas = juntoAoTecido(A, MASCARAS.get(pd) ?? null, roupa);
      if (!nas) {
        contagem.push(`${rotulo}: máscara não confere, sem poses`);
        continue;
      }
      let np = 0;
      for (const t of nas) {
        const s = assinaturaTriangulo(A.P, A.I, t);
        if (vistas.has(s)) continue;
        vistas.add(s);
        np++;
        for (let k = 0; k < 3; k++)
          for (let e = 0; e < 3; e++) saida.push(Math.round(A.P[A.I[t * 3 + k] * 3 + e] * 64));
      }
      contagem.push(`${rotulo} poses +${np}`);
    }
    const antes = d.coberturaCorpo ? Buffer.from(d.coberturaCorpo, "base64").length / 18 : 0;
    d.coberturaCorpo = Buffer.from(Int16Array.from(saida).buffer).toString("base64");
    mudou++;
    console.log(`${m.nome}/${parte}: ${antes} → ${saida.length / 9} (${contagem.join(", ")})`);
    // a mesma cobertura na peça de origem, para um novo juntar-vestidos manter
    const arq = m.interno
      ? `build/modelos/bustos-integrais/${m.nome}_${parte}_anim.json`
      : `build/modelos/${m.nome}_${parte}_anim.json`;
    if (existsSync(arq)) {
      const b = JSON.parse(readFileSync(arq, "utf8")) as DadosAnim;
      b.coberturaCorpo = d.coberturaCorpo;
      writeFileSync(arq, JSON.stringify(b));
    }
  }
}
writeFileSync(ARQ, JSON.stringify(pacote));
console.log(`${mudou} peças com a cobertura recalculada; ${ARQ} gravado`);
