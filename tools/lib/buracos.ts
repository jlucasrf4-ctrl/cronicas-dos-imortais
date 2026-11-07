/* Achar "buracos" num ícone RGBA (ver tools/fix-icon-holes.ts). Puro, sem I/O: testado em tests/unit/buracos.test.ts. */
const ALFA_MIN = 20;
const BURACO_MIN = 3;
const BURACO_MAX = 0.12; // fração da área
const COR_MIN = 48;

/** Devolve os índices dos pixels a tornar opacos (vazio se não houver o que corrigir). */
export function acharBuracos(rgba: Uint8Array, w: number, h: number): number[] {
  const n = w * h;
  const fora = new Uint8Array(n); // 1 = fundo ligado à borda
  const pilha: number[] = [];
  const vazio = (i: number) => rgba[i * 4 + 3] <= ALFA_MIN;
  const semear = (i: number) => {
    if (!fora[i] && vazio(i)) {
      fora[i] = 1;
      pilha.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    semear(x);
    semear((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    semear(y * w);
    semear(y * w + w - 1);
  }
  const vizinhos = (i: number, f: (j: number) => void) => {
    const x = i % w;
    if (x > 0) f(i - 1);
    if (x < w - 1) f(i + 1);
    if (i >= w) f(i - w);
    if (i < n - w) f(i + w);
  };
  while (pilha.length) vizinhos(pilha.pop()!, semear);

  const visto = new Uint8Array(n);
  const corrigir: number[] = [];
  for (let i0 = 0; i0 < n; i0++) {
    if (visto[i0] || fora[i0] || !vazio(i0)) continue;
    const comp: number[] = [];
    visto[i0] = 1;
    pilha.push(i0);
    while (pilha.length) {
      const i = pilha.pop()!;
      comp.push(i);
      vizinhos(i, (j) => {
        if (!visto[j] && !fora[j] && vazio(j)) {
          visto[j] = 1;
          pilha.push(j);
        }
      });
    }
    if (comp.length < BURACO_MIN || comp.length > BURACO_MAX * n) continue;
    let soma = 0;
    for (const i of comp) soma += Math.max(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    if (soma / comp.length > COR_MIN) corrigir.push(...comp);
  }
  return corrigir;
}
