/* ==== v8.0 — relevo do chão do campo aberto (mantenedor 2026-10-25: "o terreno ainda é apenas uma tinta, não tem
   malha") ====
   O chão de mundo_cena.ts era uma grade plana com cor por vértice: a luz do jogo é em faixas e plana demais para mostrar
   ondulação suave. Agora: altura de verdade (três ondas de ruído presas ao mundo), triângulos irregulares (cada vértice
   da grade sai um pouco do lugar, a diagonal de cada casa é sorteada) com uma cor chapada cada, e a luz da encosta
   gravada na cor (o lado virado para o sol mais claro, o de trás mais escuro), como nas árvores low poly. Tudo que anda
   ou fica no chão acompanha a altura (renderer.ts, erguerNoRelevo). Funções puras: valem no jogo e nos testes. ==== */

/** ondas: [comprimento (px do campo), altura (± px)] — larga, média e o grão fino; sombra: quanto a inclinação do
 *  triângulo muda o brilho (luz gravada); grao: variação de brilho de um triângulo ao outro; tremor: quanto cada
 *  vértice da grade sai do lugar (fração do lado da casa) para os triângulos não ficarem em grade. */
const RELEVO = {
  ondas: [
    [520, 4.5],
    [150, 2.6],
    [44, 1],
  ] as [number, number][],
  sombra: 2.3,
  grao: 0.07,
  tremor: 0.34,
};

/** A direção da luz do campo (renderer.ts, glFrame: Ld), para a luz gravada nas encostas. */
const LD = (() => {
  const v = [0.55, -0.62, 0.42],
    l = Math.hypot(v[0], v[1], v[2]);
  return v.map((x) => x / l);
})();

export function hashRelevo(i: number, j: number, k: number) {
  const s = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
/** Ruído de valor suave (0..1), uma oitava, manchas de `esc` px. */
function ruido(x: number, z: number, esc: number, k: number) {
  const u = x / esc,
    v = z / esc,
    i = Math.floor(u),
    j = Math.floor(v),
    fu = u - i,
    fv = v - j,
    su = fu * fu * (3 - 2 * fu),
    sv = fv * fv * (3 - 2 * fv),
    a = hashRelevo(i, j, k),
    b = hashRelevo(i + 1, j, k),
    c = hashRelevo(i, j + 1, k),
    d = hashRelevo(i + 1, j + 1, k);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
}

/** A altura do relevo (px) no ponto absoluto do mundo (px do campo, já com o canto do campo somado). */
export function alturaRelevo(x: number, z: number) {
  let h = 0;
  RELEVO.ondas.forEach(([esc, amp], q) => (h += (ruido(x, z, esc, 40 + q) - 0.5) * 2 * amp));
  return h;
}

/** O deslocamento (x, z) do vértice (gi, gj) da grade absoluta (lado `s`): os blocos vizinhos calculam o mesmo. */
export function tremorVertice(gi: number, gj: number, s: number): [number, number] {
  const t = RELEVO.tremor * s;
  return [(hashRelevo(gi, gj, 61) - 0.5) * t, (hashRelevo(gi, gj, 62) - 0.5) * t];
}

/** O chão plano das arenas e do acampamento com cara de malha (sem relevo: lá nada se ergue sobre o chão): o quadrado
 *  (x, z) de lado T em S×S; os vértices de dentro saem do lugar (os da borda ficam na grade: o vizinho pode ter outra
 *  divisão), a diagonal de cada pedaço é sorteada e cada triângulo tem uma cor (a média dos cantos × o grão). */
export function quadradoFacetado(
  b: { p: number[]; n: number[]; c: number[] },
  x: number,
  z: number,
  T: number,
  S: number,
  cor: (x: number, z: number) => number[],
) {
  const s = T / S,
    V: number[][] = [],
    C: number[][] = [];
  for (let j = 0; j <= S; j++)
    for (let i = 0; i <= S; i++) {
      let px = x + i * s,
        pz = z + j * s;
      if (i > 0 && i < S && j > 0 && j < S) {
        const [tx, tz] = tremorVertice(Math.round(px / s), Math.round(pz / s), s);
        px += tx;
        pz += tz;
      }
      V.push([px, pz]);
      C.push(cor(px, pz));
    }
  const v = (i: number, j: number) => j * (S + 1) + i;
  const tri = (a: number, c: number, d: number, sem: number) => {
    const k = 1 + (hashRelevo(sem, 9, 65) - 0.5) * RELEVO.grao;
    for (const q of [a, c, d]) {
      b.p.push(V[q][0], 0, V[q][1]);
      b.n.push(0, 1, 0);
      b.c.push(
        ((C[a][0] + C[c][0] + C[d][0]) / 3) * k,
        ((C[a][1] + C[c][1] + C[d][1]) / 3) * k,
        ((C[a][2] + C[c][2] + C[d][2]) / 3) * k,
      );
    }
  };
  for (let j = 0; j < S; j++)
    for (let i = 0; i < S; i++) {
      const gi = Math.round((x + i * s) / s),
        gj = Math.round((z + j * s) / s),
        sem = gi * 7919 + gj * 104729,
        a = v(i, j),
        r = v(i + 1, j),
        rr = v(i + 1, j + 1),
        d = v(i, j + 1);
      if (hashRelevo(gi, gj, 64) < 0.5) {
        tri(a, rr, r, sem);
        tri(a, d, rr, sem + 1);
      } else {
        tri(a, d, r, sem);
        tri(r, d, rr, sem + 1);
      }
    }
}

/** Brilho de um triângulo (luz gravada × grão) pela normal (não precisa ser unitária) e uma semente. */
export function brilhoFace(nx: number, ny: number, nz: number, sem: number) {
  const l = Math.hypot(nx, ny, nz) || 1;
  if (ny < 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  const d = -(nx * LD[0] + ny * LD[1] + nz * LD[2]) / l,
    plano = -LD[1],
    k = 1 + RELEVO.sombra * (d - plano);
  return Math.min(1.28, Math.max(0.72, k)) * (1 + (hashRelevo(sem, 7, 63) - 0.5) * RELEVO.grao);
}
