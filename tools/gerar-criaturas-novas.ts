/* v8.1 — esqueletos e movimentos próprios da quimera, do grifo e da hidra, para a prévia de modelos. */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { Matrix4, Quaternion, Vector3 } from "three";
import { lerGLB, caixa, soldar, desenhar } from "./lib/glb.ts";
import { decodificarAnim, poseClip, matrizesPose, deformarMalha, type DadosAnim } from "../src/render/gl/esqueleto.ts";

const b64 = (v: ArrayBufferView) => Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString("base64");
const suave = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
interface Osso {
  nome: string;
  pai: number;
  pos: number[];
  tipo: string;
  lado: number;
}
for (const [nome, arquivo] of [
  ["quimera", "fantasy dragon 3d model.glb"],
  ["grifo", "griffin 3d model.glb"],
  ["hidra", "three-headed dragon 3d model.glb"],
]) {
  const pasta = `build/modelos/${nome}_tpose`,
    plano = `tools/modelos/${nome}.json`;
  writeFileSync(
    plano,
    JSON.stringify(
      {
        nome,
        glb: "arquivos de transferência/3.11.2026/" + arquivo,
        altura: 1.7,
        triangulos: 18000,
        texW: 2048,
        texturaSaida: 1536,
        pasta,
      },
      null,
      2,
    ) + "\n",
  );
  execFileSync(process.execPath, ["--max-old-space-size=6144", "tools/reduzir-modelo.ts", plano], { stdio: "inherit" });
  const m = await lerGLB(`${pasta}/${nome}_tpose.glb`, 1024),
    { mn, mx } = caixa(m.P);
  const h = mx[1] - mn[1],
    sc = 48 / h,
    largura = (mx[0] - mn[0]) / 2;
  const xMeio = (mn[2] + mx[2]) / 2,
    frente = mx[2],
    tras = mn[2];
  const ossos: Osso[] = [];
  const osso = (n: string, pai: number, p: number[], tipo = "corpo", lado = 0) => {
    ossos.push({ nome: n, pai, pos: p, tipo, lado });
    return ossos.length - 1;
  };
  const raiz = osso("Hips", -1, [xMeio, h * 0.34, 0]);
  const coluna = osso("Spine", raiz, [xMeio, h * 0.5, 0]);
  const pescocos: number[] = [];
  if (nome === "hidra") {
    const alturas = [0.55, 0.94, 0.7, 0.91, 0.57];
    for (let k = 0; k < 5; k++) {
      const z = (k - 2) * largura * 0.42;
      const n = osso(`Pescoco${k + 1}`, coluna, [xMeio + (frente - xMeio) * 0.35, h * 0.45, z * 0.55], "pescoco", k);
      pescocos.push(n);
      osso(`Cabeca${k + 1}`, n, [frente * 0.8, h * alturas[k] * 0.85, z], "cabeca", k);
    }
  } else {
    const n = osso("Neck", coluna, [frente * 0.65, h * (nome === "grifo" ? 0.67 : 0.48), 0], "pescoco");
    pescocos.push(n);
    osso("Head", n, [frente * 0.8, h * (nome === "grifo" ? 0.82 : 0.57), 0], "cabeca");
    if (nome === "quimera") {
      const n2 = osso("PescocoCabra", coluna, [xMeio, h * 0.7, 0], "pescoco", 1);
      pescocos.push(n2);
      osso("CabecaCabra", n2, [xMeio, h * 0.88, 0], "cabeca", 1);
    }
  }
  const asas: number[] = [];
  if (nome !== "hidra")
    for (const lado of [-1, 1]) {
      const a = osso(`Asa${lado}`, coluna, [xMeio, h * 0.65, lado * largura * 0.2], "asa", lado);
      asas.push(a);
      osso(`PontaAsa${lado}`, a, [xMeio, h * 0.64, lado * largura * 0.58], "pontaAsa", lado);
    }
  const pernas: number[] = [];
  for (const lado of [-1, 1])
    for (const dianteira of [false, true]) {
      const x = dianteira ? xMeio + (frente - xMeio) * 0.55 : xMeio + (tras - xMeio) * 0.35;
      const p = osso(
        `Perna${lado}_${dianteira}`,
        raiz,
        [x, h * 0.28, lado * largura * (nome === "hidra" ? 0.48 : 0.23)],
        "perna",
        lado * (dianteira ? 1 : -1),
      );
      pernas.push(p);
      osso(`Pata${lado}_${dianteira}`, p, [x, h * 0.1, ossos[p].pos[2]], "pata", ossos[p].lado);
    }
  const cauda = osso("Cauda", raiz, [tras * 0.6, h * 0.3, 0], "cauda");
  const sol = soldar(m.P),
    nv = sol.n,
    P = new Int16Array(nv * 3),
    J = new Uint8Array(nv * 4),
    W = new Uint8Array(nv * 4);
  for (let v = 0; v < m.P.length / 3; v++) {
    const id = sol.id[v],
      x = m.P[v * 3 + 2],
      y = m.P[v * 3 + 1],
      z = -m.P[v * 3];
    P.set([Math.round(x * sc * 64), Math.round(y * sc * 64), Math.round(z * sc * 64)], id * 3);
    const pesos = new Map<number, number>([
      [raiz, 1 - suave(0.25 * h, 0.6 * h, y)],
      [coluna, suave(0.25 * h, 0.6 * h, y)],
    ]);
    const colocar = (os: number, peso: number) => {
      for (const [k, w] of pesos) pesos.set(k, w * (1 - peso));
      pesos.set(os, (pesos.get(os) ?? 0) + peso);
    };
    if (y < h * 0.36 && Math.abs(z) > largura * 0.09) {
      const p = pernas.reduce((a, b) =>
        Math.hypot(x - ossos[a].pos[0], z - ossos[a].pos[2]) < Math.hypot(x - ossos[b].pos[0], z - ossos[b].pos[2])
          ? a
          : b,
      );
      const peso = 1 - suave(h * 0.24, h * 0.37, y);
      colocar(p, peso);
      if (y < h * 0.15) colocar(p + 1, 1 - suave(h * 0.07, h * 0.16, y));
    }
    if (nome === "hidra" && y > h * 0.42) {
      const n = pescocos.reduce((a, b) =>
        Math.abs(z - ossos[a + 1].pos[2]) < Math.abs(z - ossos[b + 1].pos[2]) ? a : b,
      );
      colocar(n, suave(h * 0.42, h * 0.55, y));
      colocar(n + 1, suave(ossos[n + 1].pos[1] - h * 0.07, ossos[n + 1].pos[1] + h * 0.03, y));
    } else if (nome !== "hidra") {
      const pesoAsa = suave(largura * 0.22, largura * 0.4, Math.abs(z)) * suave(h * 0.35, h * 0.55, y);
      const a = asas[z < 0 ? 0 : 1];
      colocar(a, pesoAsa);
      if (Math.abs(z) > largura * 0.58) colocar(a + 1, pesoAsa * suave(largura * 0.58, largura * 0.8, Math.abs(z)));
      if (Math.abs(z) < largura * 0.3) {
        const n = nome === "quimera" && y > h * 0.72 ? pescocos[1] : pescocos[0];
        const peso =
          suave(ossos[n].pos[1] - h * 0.05, ossos[n].pos[1] + h * 0.1, y) *
          (1 - suave(largura * 0.18, largura * 0.3, Math.abs(z)));
        colocar(n, peso);
        colocar(n + 1, peso * suave(ossos[n + 1].pos[1] - h * 0.03, ossos[n + 1].pos[1] + h * 0.05, y));
      }
    }
    if (x < tras * 0.75 && y < h * 0.5 && Math.abs(z) < largura * 0.15) colocar(cauda, suave(tras * 0.5, tras, x));
    const maiores = [...pesos].sort((a, b) => b[1] - a[1]).slice(0, 4),
      soma = maiores.reduce((s, [, w]) => s + w, 0);
    let total = 0;
    maiores.forEach(([j, w], k) => {
      J[id * 4 + k] = j;
      W[id * 4 + k] = k === maiores.length - 1 ? 255 - total : Math.floor((w / soma) * 255);
      total += W[id * 4 + k];
    });
  }
  const repouso = ossos.map((o) => o.pos.map((v, k) => v - (o.pai >= 0 ? ossos[o.pai].pos[k] : 0)));
  const matrizRaiz = new Matrix4().makeScale(sc, sc, sc);
  const clips: DadosAnim["clips"] = {};
  for (const acao of [
    "parada",
    "andar",
    "correr",
    "ataque",
    "receber_dano",
    "morrer",
    ...(asas.length ? ["voar"] : []),
  ]) {
    const fps = 24,
      dur = acao === "parada" ? 3 : acao === "morrer" ? 1.4 : acao === "correr" ? 0.65 : 1.2;
    const n = Math.round(dur * fps) + 1,
      R = new Int16Array(n * ossos.length * 4),
      Q = new Int16Array(n * 3);
    for (let f = 0; f < n; f++) {
      const t = f / (n - 1),
        onda = Math.sin(t * Math.PI * 2),
        pulso = Math.sin(t * Math.PI);
      Q.set(
        ossos[0].pos.map((v, k) =>
          Math.round((v + (k === 1 ? (acao === "morrer" ? -h * 0.2 * t : h * 0.006 * onda) : 0)) * 10000),
        ),
        f * 3,
      );
      ossos.forEach((o, j) => {
        let ang = 0;
        const eixo = new Vector3(0, 0, 1);
        if (o.tipo === "corpo") ang = 0.01 * onda;
        if (o.tipo === "pescoco" || o.tipo === "cabeca") {
          eixo.set(0, 1, 0);
          ang = 0.025 * Math.sin(t * Math.PI * 2 + o.lado * 0.8);
        }
        if (o.tipo === "cauda") {
          eixo.set(0, 1, 0);
          ang = 0.12 * onda;
        }
        if ((acao === "andar" || acao === "correr") && o.tipo === "perna")
          ang = onda * o.lado * (acao === "correr" ? 0.4 : 0.22);
        if ((acao === "andar" || acao === "correr") && o.tipo === "pata") ang = Math.max(0, -onda * o.lado) * 0.25;
        if (o.tipo === "asa" || o.tipo === "pontaAsa") {
          eixo.set(1, 0, 0);
          ang = o.lado * (acao === "voar" ? 0.35 * onda : 0.025 * onda);
        }
        if (acao === "ataque" && (o.tipo === "pescoco" || o.tipo === "cabeca")) {
          eixo.set(0, 0, 1);
          ang = -0.22 * pulso;
        }
        if (acao === "receber_dano" && j === coluna) ang = 0.16 * Math.sin(t * Math.PI * 4) * (1 - t);
        if (acao === "morrer" && j === raiz) {
          eixo.set(1, 0, 0);
          ang = 1.15 * suave(0, 1, t);
        }
        const q = new Quaternion().setFromAxisAngle(eixo, ang);
        R.set(
          q.toArray().map((v) => Math.round(v * 32767)),
          (f * ossos.length + j) * 4,
        );
      });
    }
    clips[acao] = { fps, n, r: b64(R), q: b64(Q) };
  }
  const uvBytes = readFileSync(`${pasta}/${nome}_tpose_uv.bin`);
  const uvFonte = new Float32Array(uvBytes.buffer.slice(uvBytes.byteOffset, uvBytes.byteOffset + uvBytes.byteLength));
  const dados: DadosAnim = {
    versao: 1,
    juntas: ossos.map((o) => o.nome),
    pais: ossos.map((o) => o.pai),
    repouso,
    raiz: matrizRaiz.toArray(),
    ibm: ossos.map((o) =>
      matrizRaiz
        .clone()
        .multiply(new Matrix4().makeTranslation(...(o.pos as [number, number, number])))
        .invert()
        .toArray(),
    ),
    malha: {
      p: b64(P),
      j: b64(J),
      w: b64(W),
      i: b64(Uint16Array.from(m.I, (i) => sol.id[i])),
      c: b64(Buffer.alloc(m.I.length, 255)),
      uv: b64(Uint16Array.from(uvFonte, (v) => Math.round(Math.max(0, Math.min(1, v)) * 65535))),
    },
    tex: "data:image/webp;base64," + readFileSync(`${pasta}/${nome}_tpose_tex.webp`).toString("base64"),
    clips,
  };
  writeFileSync(`build/modelos/${nome}_anim.json`, JSON.stringify(dados));
  const A = decodificarAnim(dados);
  for (const acao of ["parada", "andar", "ataque"]) {
    const def = deformarMalha(A, matrizesPose(A, poseClip(A, acao, 0.35, true)));
    await desenhar(
      `${pasta}/anim_${acao}.png`,
      Float32Array.from(def.p, (v, k) => (k % 3 === 0 ? -def.p[k + 2] : k % 3 === 2 ? def.p[k - 2] : v)),
      Uint32Array.from({ length: def.p.length / 3 }, (_, k) => k),
      () => [180, 160, 130],
      { W: 700 },
    );
  }
  console.log(`${nome}: ${m.I.length / 3} triângulos, ${ossos.length} juntas, ${Object.keys(clips).length} animações`);
}
