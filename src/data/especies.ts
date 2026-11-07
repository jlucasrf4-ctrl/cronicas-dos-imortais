/* ==== Fase 4 ====
   fauna e flora: espécies (SPECIES, chaves, limites), plantas (PLANTS, rollPlantKind), horários de atividade,
   faixas de fome, reprodução e informações da fauna selvagem, rótulos de estado e de habitat, o javali (BOAR).
   Saíram de base/00, base/01, base/07 e v5.8 */

export const ALL_KEYS = ["rabbit", "deer", "wolf", "fox", "duck", "eagle"];
export const WILD_KEYS = ["fox", "duck", "eagle"];
export const WILD_CAP: Record<string, number> = { duck: 24, fox: 9, eagle: 6 };

/* ---------------------------------------------------------------------
   1. DADOS DE ESPÉCIE (separados da lógica)
--------------------------------------------------------------------- */
export interface Especie {
  key: string;
  label: string;
  diet: string;
  color: string;
  radius: number;
  speedWalk: number;
  speedFlee: number;
  speedChase: number;
  visionRange: number;
  dangerRange: number;
  hungerRate: number;
  thirstRate: number;
  energyDrainWalk: number;
  energyDrainFlee?: number;
  energyRegenRest: number;
  eatRate: number;
  drinkRate: number;
  matureAgeDay: number;
  maxAgeDay: number;
  reproCooldownDay: number;
  litterSize: number[];
  activity: string;
  preySpecies: string[];
  predators: string[];
  carryingCapacity: number;
  fleeFrom?: string[];
  mateHungerMax: number;
  mateThirstMax?: number;
  meatValue?: number;
  energyDrainChase?: number;
  attackRadius?: number;
  giveUpDistance?: number;
  // acrescentados depois
  _cap2?: number;
  _capV66?: number;
}
export const SPECIES: Record<string, Especie> = {
  rabbit: {
    key: "rabbit",
    label: "Coelho",
    diet: "herbivore",
    color: "#8fd1ff",
    radius: 3.2,
    speedWalk: 3.2,
    speedFlee: 14,
    speedChase: 0,
    visionRange: 95,
    dangerRange: 58,
    hungerRate: 0.04,
    thirstRate: 0.055,
    energyDrainWalk: 0.05,
    energyDrainFlee: 0.35,
    energyRegenRest: 0.22,
    eatRate: 14,
    drinkRate: 22,
    matureAgeDay: 1.5,
    maxAgeDay: 14,
    reproCooldownDay: 0.7,
    litterSize: [2, 4],
    activity: "crepuscular",
    preySpecies: [],
    predators: ["wolf"],
    carryingCapacity: 90,
    fleeFrom: ["wolf"],
    mateHungerMax: 60,
    mateThirstMax: 60,
    meatValue: 34, // um coelho sacia pouco — o lobo mal tira o pior da fome
  },
  deer: {
    key: "deer",
    label: "Cervo Tastaviteiro",
    diet: "herbivore",
    color: "#e0a94f",
    radius: 5,
    speedWalk: 2.8,
    speedFlee: 12,
    speedChase: 0,
    visionRange: 120,
    dangerRange: 70,
    hungerRate: 0.028,
    thirstRate: 0.04,
    energyDrainWalk: 0.045,
    energyDrainFlee: 0.3,
    energyRegenRest: 0.18,
    eatRate: 10,
    drinkRate: 18,
    matureAgeDay: 2.5,
    maxAgeDay: 20,
    reproCooldownDay: 1.6,
    litterSize: [1, 2],
    activity: "diurnal",
    preySpecies: [],
    predators: ["wolf"],
    carryingCapacity: 42,
    fleeFrom: ["wolf"],
    mateHungerMax: 60,
    mateThirstMax: 60,
    meatValue: 88, // um cervo é uma refeição grande — sacia o lobo quase por completo
  },
  wolf: {
    key: "wolf",
    label: "Lobo",
    diet: "carnivore",
    color: "#d1595b",
    radius: 5.6,
    speedWalk: 3.0,
    speedFlee: 0,
    speedChase: 13,
    visionRange: 165,
    dangerRange: 0,
    hungerRate: 0.02,
    thirstRate: 0.032,
    energyDrainWalk: 0.045,
    energyDrainChase: 0.55,
    energyRegenRest: 0.16,
    eatRate: 55,
    drinkRate: 20,
    matureAgeDay: 5,
    maxAgeDay: 28,
    reproCooldownDay: 5,
    litterSize: [1, 2],
    activity: "nocturnal",
    preySpecies: ["deer", "rabbit"],
    predators: [],
    carryingCapacity: 12,
    attackRadius: 11,
    giveUpDistance: 230,
    mateHungerMax: 60,
  },
};

/* v3.6 — ajuste de equilíbrio (medido em simulação headless, 40+ dias, várias sementes) */
Object.assign(SPECIES.rabbit, { matureAgeDay: 1.6, reproCooldownDay: 1.0, litterSize: [2, 3], carryingCapacity: 70 });
Object.assign(SPECIES.wolf, { matureAgeDay: 4, reproCooldownDay: 3.5, carryingCapacity: 14 });

interface TipoPlanta {
  label: string;
  tag: string;
  color: string;
  weight: number;
  desc: string;
}
export const PLANTS: Record<string, TipoPlanta> = {
  folhama: {
    label: "Folhama",
    tag: "Regulador de runas",
    color: "#5c8a45",
    weight: 32,
    desc: "Planta multifuncional de bosques e clareiras perto d'água. As folhas servem como papel regulador de runas; a raquilha trançada vira corda ou pavio; as sementes são pó fumável; a raiz — Tastavitra — é alimento e ingrediente mágico.",
  },
  cenoura: {
    label: "Cenoura-Brava",
    tag: "Forragem comum",
    color: "#c9822f",
    weight: 24,
    desc: "Raiz silvestre comum em clareiras, parente distante da cenoura cultivada nas fazendas. Sem propriedade mágica conhecida — mas é a base alimentar de quase todo herbívoro da floresta.",
  },
  molas: {
    label: "Molas",
    tag: "Mecanismos e gatilhos",
    color: "#7fae5a",
    weight: 10,
    desc: "Flor de miolo rígido-elástico, extraível sem matar a planta. Usada por inventores de campo em gatilhos rúnicos e pequenos mecanismos.",
  },
  fungiluma: {
    label: "Fungiluma",
    tag: "Tintas",
    color: "#6b5a8a",
    weight: 8,
    desc: "Cogumelos usados para tintas de registro e ilustração. Existem variedades pretas (comuns), vermelhas (venenosas se ingeridas), azuis, amarelas, verdes e roxas (raras).",
  },
  guardamel: {
    label: "Guarda-Mel",
    tag: "Melado e Agnorama",
    color: "#d1a23f",
    weight: 8,
    desc: "Planta cuja flor acumula melado numa bacia natural. Base do Agnorama, bebida feita com melado, raiz de Folhama pilada e água.",
  },
  repelisia: {
    label: "Repelísia",
    tag: "Repelente natural",
    color: "#8ab06a",
    weight: 6,
    desc: "Flor cujas pontas resinosas, queimadas, soltam fumaça cítrico-floral que afasta insetos por horas.",
  },
  papacorvo: {
    label: "Papa-Corvo",
    tag: "Paralisante de aves",
    color: "#9a6a8a",
    weight: 4,
    desc: "Planta cuja seiva paralisa aves temporariamente, sem matá-las — funciona como espantalho natural de plantações.",
  },
  luminerva: {
    label: "Luminerva",
    tag: "Marcador de trilha",
    color: "#7fd1c8",
    weight: 3,
    desc: "Planta rasteira de folhas bioluminescentes à noite, mais brilhantes perto de energia rúnica. Usada como marcador de trilha.",
  },
  espinforca: {
    label: "Espinforça",
    tag: "Espinhos e resina",
    color: "#a3843f",
    weight: 3,
    desc: "Arbusto de espinhos duros e flexíveis, usados como dardos ou resinas perfurantes. Ao toque libera aroma doce que atrai pequenos animais.",
  },
  nectarina: {
    label: "Nectarina Sombria",
    tag: "Néctar de vigor",
    color: "#8a4a6b",
    weight: 2,
    desc: "Flor alta de néctar escuro usado em poções de vigor. As folhas, mastigadas, aumentam a concentração.",
  },
};
const PLANT_KEYS = Object.keys(PLANTS);
const PLANT_WEIGHT_TOTAL = PLANT_KEYS.reduce((s, k) => s + PLANTS[k].weight, 0);
export function rollPlantKind() {
  let r = Math.random() * PLANT_WEIGHT_TOTAL;
  for (const k of PLANT_KEYS) {
    r -= PLANTS[k].weight;
    if (r <= 0) return k;
  }
  return PLANT_KEYS[0];
}

export const ACTIVITY_WINDOWS: Record<string, (tod: number) => boolean> = {
  diurnal: (tod: number) => tod > 6 * 60 && tod < 19 * 60,
  nocturnal: (tod: number) => tod > 20 * 60 || tod < 5 * 60,
  crepuscular: (tod: number) => (tod > 4.5 * 60 && tod < 7.5 * 60) || (tod > 17.5 * 60 && tod < 21 * 60),
};
export const HUNGER_TIERS: [min: number, rotulo: string, mult: number][] = [
  [80, "Excelente", 1],
  [60, "Bom", 0.95],
  [40, "Normal", 0.85],
  [22, "Fraco", 0.66],
  [0, "Faminto", 0.45],
];
export const STATE_LABEL: Record<string, string> = {
  // Fase 4: a v7.6 tinha seekFood duas vezes ("Buscando comida" e, no fim, "Buscando comida/carcaça"); valia a última,
  // na posição da primeira. Ficou uma só, com o mesmo valor e a mesma ordem das chaves (o TS recusa a repetida).
  idle: "Parado",
  wander: "Vagando",
  seekFood: "Buscando comida/carcaça",
  eating: "Comendo",
  seekWater: "Buscando água",
  drinking: "Bebendo",
  resting: "Descansando",
  fleeing: "Fugindo",
  hunting: "Caçando",
};
interface EspecieUI {
  label: string;
  color: string;
}
export const SP_UI: Record<string, EspecieUI> = {
  rabbit: { label: "Coelho", color: "#8fd1ff" },
  deer: { label: "Cervo", color: "#e0a94f" },
  wolf: { label: "Lobo", color: "#d1595b" },
  fox: { label: "Raposa", color: "#e07a3f" },
  duck: { label: "Pato", color: "#6fd1b0" },
  eagle: { label: "Águia", color: "#c9a2ff" },
};
export const HAB_WINDOW_MIN = 3 * 1440;
export const WILD_BREED: Record<string, { every: number; chance: number; hungerMax: number; n: number[] }> = {
  duck: { every: 480, chance: 0.55, hungerMax: 50, n: [1, 3] },
  fox: { every: 2160, chance: 0.5, hungerMax: 55, n: [1, 2] },
  eagle: { every: 2880, chance: 0.4, hungerMax: 55, n: [1, 1] },
};
export const WILD_INFO: Record<string, { tag: string; color: string; name: string; desc: string; btn: string | null }> =
  {
    duck: {
      tag: "AVE",
      color: "#8fd1ff",
      name: "Pato Selvagem",
      desc: "Anda em bandos perto de rios e lagos. Foge de gente e de raposas, voando para outra lagoa. Fornece penas para flechas.",
      btn: "🏹 Mandar caçar patos",
    },
    eagle: {
      tag: "AVE",
      color: "#e0b35f",
      name: "Águia",
      desc: "Predador aéreo: patrulha áreas abertas e montanhas, pousa em pedras e árvores e mergulha sobre coelhos. Difícil de abater, mas dá a rara Pena de Águia.",
      btn: "🏹 Mandar caçar águias",
    },
    fox: {
      tag: "PREDADOR",
      color: "#e07a3f",
      name: "Raposa",
      desc: "Caçadora de florestas e campos. Persegue coelhos e aves pousadas; foge de pessoas e lobos.",
      btn: null,
    },
  };
export const WSTATE: Record<string, string> = {
  idle: "descansando",
  fly: "voando",
  patrol: "patrulhando",
  dive: "mergulhando na presa",
  perch: "pousada",
  prowl: "rondando",
  chase: "perseguindo presa",
  flee: "fugindo",
  eat: "comendo",
};
export const BOAR = { wind: [0.9, 2.3], speed: 205, range: 8, notice: 7, cd: [2.2, 3.4], minD: 3 }; // mira aleatória, percepção menor e espaço para escapar da investida
/** v8.1 (mantenedor, 2026-10-31, opção "B"): a investida que acerta joga a heroína de costas no chão (o clip
    "derrubada", render/gl/animado.ts) e ela fica `t` s sem agir (era 1,1 s); enquanto ela está caída o javali não começa
    outra investida (senão a enfurecida acertava de novo antes de ela levantar). */
export const BOAR_DERRUBA = { t: 1.8 };
/** v8.1 (mantenedor, 2026-10-30: "os bichos tão batendo a cabeça na árvore; o ideal é continuarem batendo, mas com o
    player fazendo o jogo de dodge"): no campo aberto o javali só começa a mirar com o caminho até a heroína livre de
    tronco e água; na investida, só é trombada quando o tronco barra de frente (`frente`: menos que essa fração do passo
    andou para a frente; raspar de lado escorrega e segue); a trombada atordoa (`tonto` s) e tira `folego` do fôlego dele. */
export const BOAR_ARVORE = { frente: 0.5, tonto: 2.2, folego: 0.3 };
