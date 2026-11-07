/* ==== Fase 4 — dados do nascimento: atributos (ATTR_DEFS, BIRTH), afinidades e genéticas. Saiu de base/01 (v3.8) ==== */

export const ATTR_DEFS = [
  // enxuto: cada atributo faz UMA coisa
  { id: "forca", name: "Força", icon: "💪", desc: "Dano corpo a corpo · acelera um pouco a carga do arco" },
  { id: "constituicao", name: "Constituição", icon: "🫀", desc: "HP máximo · regeneração de HP e de mana" },
  { id: "destreza", name: "Destreza", icon: "🎯", desc: "Dano extra contra inimigo marcado" },
  { id: "velocidade", name: "Velocidade", icon: "👟", desc: "Velocidade de ataque e de movimento" },
  { id: "mana", name: "Mana", icon: "🔷", desc: "Mana máxima (dormente até a Magia existir)" },
];
export const BIRTH = { base: 5, pool: 20, max: 12 }; // todo personagem nasce com o MESMO total (45): muda a forma, nunca a quantidade

interface Afinidade {
  name: string;
  icon: string;
  color: string;
  ink: string;
  birth: string;
}
export const AFFINITIES: Record<string, Afinidade> = {
  fogo: { name: "Fogo", icon: "🔥", color: "#ff8a2a", ink: "#b8520e", birth: "Algo queima por dentro, sem consumir." },
  raio: {
    name: "Energia/Raio",
    icon: "⚡",
    color: "#ffe14a",
    ink: "#9a7a00",
    birth: "O ar estala quando você respira.",
  },
  agua: {
    name: "Água",
    icon: "💧",
    color: "#3f9dff",
    ink: "#1f68b0",
    birth: "O mundo parece correr ao seu redor, calmo e fundo.",
  },
  ar: { name: "Ar", icon: "🌪️", color: "#7fe0c8", ink: "#1f8a70", birth: "Seus passos quase não tocam o chão." },
  terra: {
    name: "Terra",
    icon: "🪨",
    color: "#c08a4a",
    ink: "#7a4f22",
    birth: "O chão responde ao seu peso, como se o conhecesse.",
  },
  nularis: {
    name: "Nularis",
    icon: "⚪",
    color: "#f4f1ea",
    ink: "#5f5a4e",
    birth: "Onde você está, o silêncio é um pouco maior.",
  }, // magia que muda a realidade; brilho sempre branco
};
interface Genetica {
  aff: string;
  name: string;
  desc: string;
  bias: Record<string, number>;
  fav: string[];
}
export const GENETICS: Record<string, Genetica> = {
  // bias = peso na distribuição dos atributos (NUNCA muda o total) · fav = nós que ressoam (efeito maior)
  sangue_incandescente: {
    aff: "fogo",
    name: "Sangue Incandescente",
    desc: "Um corpo que esquenta com o ferimento e responde com ele.",
    bias: { forca: 1.6, constituicao: 1 },
    fav: ["corte_sangrento", "contra_golpe"],
  },
  pulso_agressivo: {
    aff: "fogo",
    name: "Pulso Agressivo",
    desc: "O coração dispara antes do golpe — e quer sempre o próximo.",
    bias: { forca: 1.2, velocidade: 1.4 },
    fav: ["impulso_escudo", "est_fogo"],
  },
  pele_termica: {
    aff: "fogo",
    name: "Pele Térmica",
    desc: "A pele aguenta o que derrubaria os outros.",
    bias: { constituicao: 1.8, mana: 0.8 },
    fav: ["guarda_firme", "ervas_frescas"],
  },
  nervos_condutores: {
    aff: "raio",
    name: "Nervos Condutores",
    desc: "Cada nervo é um fio vivo: o corpo responde antes do pensamento.",
    bias: { velocidade: 1.6, destreza: 1.2 },
    fav: ["parry_atordoante", "est_raio"],
  },
  reflexo_eletrico: {
    aff: "raio",
    name: "Reflexo Elétrico",
    desc: "Um estalo entre o olho e a mão.",
    bias: { velocidade: 1.4, forca: 1 },
    fav: ["contra_golpe", "pe_ligeiro"],
  },
  descarga_latente: {
    aff: "raio",
    name: "Descarga Latente",
    desc: "Algo acumulado, esperando o momento certo.",
    bias: { mana: 1.5, destreza: 1.3 },
    fav: ["tiro_certeiro", "rastreador"],
  },
  mare_interior: {
    aff: "agua",
    name: "Maré Interior",
    desc: "Um ritmo lento e fundo que sobe e desce.",
    bias: { constituicao: 1.5, mana: 1.3 },
    fav: ["guarda_firme", "est_agua"],
  },
  correnteza_calma: {
    aff: "agua",
    name: "Correnteza Calma",
    desc: "Move-se sem esforço aparente, sempre contornando.",
    bias: { velocidade: 1.3, destreza: 1.5 },
    fav: ["pe_ligeiro", "tiro_certeiro"],
  },
  sangue_profundo: {
    aff: "agua",
    name: "Sangue Profundo",
    desc: "Pesado e frio como o fundo de um lago.",
    bias: { constituicao: 1.4, forca: 1.3 },
    fav: ["corte_sangrento", "ervas_frescas"],
  },
  pulmoes_abertos: {
    aff: "ar",
    name: "Pulmões Abertos",
    desc: "Fôlego que parece não acabar.",
    bias: { velocidade: 1.3, constituicao: 1.3 },
    fav: ["pe_ligeiro", "olhar_atento"],
  },
  passo_etereo: {
    aff: "ar",
    name: "Passo Etéreo",
    desc: "Chega antes do som dos próprios passos.",
    bias: { velocidade: 1.7, destreza: 1 },
    fav: ["impulso_escudo", "est_ar"],
  },
  voz_do_vento: {
    aff: "ar",
    name: "Voz do Vento",
    desc: "Ouve o que ainda não aconteceu.",
    bias: { mana: 1.4, velocidade: 1.2 },
    fav: ["olhar_atento", "rastreador"],
  },
  ossos_de_rocha: {
    aff: "terra",
    name: "Ossos de Rocha",
    desc: "Um esqueleto que parece de outra era.",
    bias: { constituicao: 1.7, forca: 1.2 },
    fav: ["guarda_firme", "est_terra"],
  },
  raiz_firme: {
    aff: "terra",
    name: "Raiz Firme",
    desc: "Fica de pé onde outros caem.",
    bias: { constituicao: 1.3, destreza: 1.4 },
    fav: ["parry_atordoante", "ervas_frescas"],
  },
  pulso_telurico: {
    aff: "terra",
    name: "Pulso Telúrico",
    desc: "Sente a terra vibrar muito antes do passo.",
    bias: { forca: 1.5, mana: 1.2 },
    fav: ["contra_golpe", "olhar_atento"],
  },
  vacuo_interior: {
    aff: "nularis",
    name: "Vácuo Interior",
    desc: "Um espaço calmo no centro do peito, que nada preenche.",
    bias: { mana: 1.6, destreza: 1.2 },
    fav: ["est_nularis", "rastreador"],
  },
  sombra_quieta: {
    aff: "nularis",
    name: "Sombra Quieta",
    desc: "Existe sem chamar atenção — até o instante do golpe.",
    bias: { destreza: 1.6, velocidade: 1.2 },
    fav: ["tiro_certeiro", "corte_sangrento"],
  },
  silencio_absorvente: {
    aff: "nularis",
    name: "Silêncio Absorvente",
    desc: "Sons e golpes morrem perto dele.",
    bias: { constituicao: 1.4, mana: 1.3 },
    fav: ["parry_atordoante", "guarda_firme"],
  },
};
