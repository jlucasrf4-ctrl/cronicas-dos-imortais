/* ==== Fase 4 ====
   atributos e proficiências: efeito de cada atributo (STAT), afixos de equipamento (AF_DEFS, AF_POOL),
   proficiências (PROFS, PROF_MAX, PROF_BY). Saíram de v5.0_atributos e v5.9.05_proficiencias */

export const STAT = {
  forMelee: 0.06, // 💪 +6% de dano corpo a corpo por ponto acima de 5
  forDraw: 0.012, // 💪 +1,2% de velocidade de carga do arco por ponto acima de 5
  desCritBase: 0.02, // 🎯 crítico base 2%…
  desCrit: 0.01, // 🎯 …+1% por ponto de Destreza (5 → 7%, 12 → 14%)
  desBow: 0.05, // 🎯 +5% de dano do arco por ponto acima de 5
  critMult: 1.6, // 💥 crítico = ×1,6
  critMax: 0.5,
  velAtk: 0.03, // 👟 +3% de velocidade de ataque por ponto acima de 5
  velMove: 3.2, // 👟 px/s de movimento por ponto (base 26)
  conHp: 6, // 🫀 +6 HP por ponto
  conDef: 0.08, // 🫀 −0,08 de dano em cada golpe recebido por ponto
  mastK: 0.18,
  mastP: 0.8, // maestria: ×(1 + 0,18·nível^0,8) — cresce, mas cada nível vale um pouco menos
};
export const AF_DEFS: Record<string, { n: string; ic: string; fmt: (v: number) => string }> = {
  forca: { n: "Força", ic: "💪", fmt: (v: number) => "+" + v },
  destreza: { n: "Destreza", ic: "🎯", fmt: (v: number) => "+" + v },
  constituicao: { n: "Constituição", ic: "🫀", fmt: (v: number) => "+" + v },
  velocidade: { n: "Velocidade", ic: "👟", fmt: (v: number) => "+" + v },
  crit: { n: "Crítico", ic: "💥", fmt: (v: number) => "+" + Math.round(v * 100) + "%" },
  vida: { n: "Vida", ic: "❤", fmt: (v: number) => "+" + v },
};
export const AF_POOL: Record<string, string[]> = {
  maoD: ["forca", "forca", "destreza", "velocidade", "crit"],
  costas: ["destreza", "destreza", "crit", "forca"],
  maoE: ["constituicao", "vida", "vida"],
  cabeca: ["constituicao", "vida", "destreza"],
  peito: ["constituicao", "constituicao", "vida"],
  pernas: ["velocidade", "constituicao", "vida"],
  pes: ["velocidade", "velocidade", "vida"],
};
export const PROFS = [
  { id: "espada", n: "Espada", i: "⚔", g: "Armas", d: "Dano da espada (combo e parry)." },
  { id: "clava", n: "Clava", i: "🏏", g: "Armas", d: "Dano, carga mais rápida e mais chance de atordoar." },
  {
    id: "machado",
    n: "Machado",
    i: "🪓",
    g: "Armas",
    d: "Dano, golpe pesado aleija por mais tempo e gasta menos fôlego.",
  },
  { id: "lanca", n: "Lança", i: "🔱", g: "Armas", d: "Dano, mais chance de cravar e arrancar com mais força." },
  { id: "arco", n: "Arco", i: "🏹", g: "Armas", d: "Dano das flechas." },
  { id: "domador", n: "Domador", i: "🐾", g: "Ofícios", d: "Domar mais fácil (faixa maior, pinote mais fraco)." },
  {
    id: "coletor",
    n: "Coletor",
    i: "🪵",
    g: "Ofícios",
    d: "Faixa maior nos minigames de madeira, pedra e pesca; chance de coletar a mais.",
  },
  { id: "lenhador", n: "Lenhador", i: "🪓", g: "Ofícios", d: "Prática ao derrubar árvores e trabalhar a madeira." },
  // v8.1: a picareta (field/recursos_campo.ts)
  { id: "minerador", n: "Minerador", i: "⛏", g: "Ofícios", d: "Prática ao quebrar pedras e achar minério." },
  {
    id: "rastreio",
    n: "Rastreio",
    i: "👣",
    g: "Ofícios",
    d: "Caçada: rastro visível mais vezes, pegadas duram mais, fezes notadas de mais longe.",
  },
  { id: "pesquisador", n: "Pesquisador", i: "📖", g: "Ofícios", d: "Desmontar devolve mais material." },
  {
    id: "ferreiro",
    n: "Ferreiro",
    i: "⚒",
    g: "Ofícios",
    d: "Metal: faixa do martelo maior e anéis da cota mais fáceis.",
  },
  {
    id: "artesao",
    n: "Artesão",
    i: "🧵",
    g: "Ofícios",
    d: "Couro, tecido e madeira: corte com mais folga e costura mais fácil.",
  },
  {
    id: "lapidario",
    n: "Lapidário",
    i: "💎",
    g: "Ofícios",
    d: "Runas: traçado com mais tolerância (lapidação de gemas na campanha).",
  },
  {
    id: "sobrevivencia",
    n: "Sobrevivência",
    i: "🔥",
    g: "Ofícios",
    d: "Fogueira e assar carne mais fáceis; nível 10 acende a fogueira direto.",
  },
];
export const PROF_MAX = 10,
  PROF_BY = Object.fromEntries(PROFS.map((p) => [p.id, p]));
