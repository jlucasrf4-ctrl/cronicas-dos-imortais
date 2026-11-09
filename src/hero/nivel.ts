/* ==== Fase 4 — herói: campos padrão, XP, nível e pontos de árvore (base/01) ==== */
import { profMigrate, profWeapon, profLvOfXp, profNeed } from "./proficiencias.ts";
import { BIRTH, GENETICS } from "../data/nascimento.ts";
import { bornFromSeed } from "./nascimento.ts";
import { hashStr, newSeed } from "../core/rng.ts";
import { pushEvent } from "../sim/eventos.ts";
import { dungeon, world } from "../core/state.ts";
import { spawnDungeonToast, setBanner } from "../field/masmorra.ts";
import { sfx, xpBurst } from "../field/chao.ts";
import { PROF_BY, PROF_MAX } from "../data/atributos.ts";
import { progressoEfetivo } from "../field/progresso_hud.ts";
import { mvToast } from "../ui/avisos.ts";
import { NODE_BY_ID, SYNERGIES } from "../data/arvores.ts";
import { nodeState } from "./arvores.ts";
import { snapToLand } from "../sim/animais.ts";
import { SPAWN0 } from "../core/config.ts";
import { WORLD_K } from "../map/vetorial.ts";
import { HERO_COLORS } from "../data/herois.ts";
import { aparenciaRecrutavel, sortearAparencia } from "../render/gl/aparencias.ts";
import type { Attrs, Hero, Nascimento } from "../core/tipos.ts";

/* =====================================================================
   v3.8 — NASCIMENTO, NÍVEL E ÁRVORES  (dados modulares)
   Para expandir: acrescente entradas em AFFINITIES / GENETICS / NODES /
   SYNERGIES. Nada abaixo precisa ser alterado em funções.
   Fluxo: Nome → semente → Afinidade → Genética → Atributos → Identidade.
   Os dados (ATTR_DEFS, AFFINITIES, GENETICS, TREES, NODES, SYNERGIES), o rng com semente, bornFromSeed e as
   consultas das árvores (nodeRank, nv, synOn, nodeState) foram para src/data, src/core e src/hero (Fase 4).
   ===================================================================== */
export function ensureHero(h: Hero): Hero {
  const r = ensureHeroBase(h);
  /* v5.9.05 */
  try {
    profMigrate(h);
  } catch (_) {}
  return r;
}
/** Completa a aparência de saves antigos uma única vez, preservando os visuais femininos válidos. */
export function normalizarAparenciaHeroi(
  h: Hero,
  sortear: () => ReturnType<typeof sortearAparencia> = sortearAparencia,
) {
  // Migração única: escolhas posteriores no F2 podem usar cabeças e corpos fora do sorteio.
  if (h.aparenciaVersao === 1) return false;
  if (!aparenciaRecrutavel(h.visual)) h.visual = sortear();
  h.aparenciaVersao = 1;
  return true;
}
function ensureHeroBase(h: Hero): Hero {
  // migra personagens antigos (Vida → Constituição) e completa o que falta
  if (!h) return h;
  normalizarAparenciaHeroi(h);
  if (h._rpg) return h;
  const a = (h.attrs = h.attrs || ({} as Attrs));
  if (a.constituicao == null) a.constituicao = a.vida != null ? a.vida : BIRTH.base;
  delete a.vida;
  if (a.destreza == null) a.destreza = BIRTH.base;
  if (a.mana == null) a.mana = BIRTH.base;
  if (!h.aff || !GENETICS[h.gen]) {
    const b = bornFromSeed(h.seed || hashStr(h.id || h.name || "x"));
    h.seed = b.seed;
    h.aff = b.aff;
    h.gen = b.gen;
  }
  h.xp = h.xp || 0;
  h.lvl = h.lvl || 1;
  h.nodes = h.nodes || {};
  h.spent = h.spent || 0;
  h.treeBonus = h.treeBonus || 0;
  h.manaMax = 20 + a.mana * 4;
  if (h.mana == null) h.mana = h.manaMax;
  h._rpg = 1;
  return h;
}

export const xpNeed = (l: number) => 14 + 6 * l;
export function treePoints(h: Hero) {
  ensureHero(h);
  return Math.floor(h.lvl / 10) + h.treeBonus - h.spent;
}
export function addHeroXp(h: Hero | null | undefined, amt: number) {
  if (!h || !(amt > 0)) return;
  ensureHero(h);
  h.xp += amt;
  /* v8.3 — o número da experiência sobe acima do herói e a barra de XP brilha */
  if (dungeon && dungeon.active && dungeon.hero === h) {
    const n = amt >= 1 ? Math.round(amt) : Math.round(amt * 10) / 10;
    spawnDungeonToast("+" + n + " XP", dungeon.px + 14, dungeon.py - 58, "#d9a8ff", amt >= 10 ? 15 : 12);
    dungeon.xpPulso = 0.9;
  }
  while (h.xp >= xpNeed(h.lvl)) {
    h.xp -= xpNeed(h.lvl);
    h.lvl++;
    onHeroLevelUp(h);
  }
}
function onHeroLevelUp(h: Hero) {
  const pt = h.lvl % 10 === 0;
  pushEvent(h.name + " alcançou o nível " + h.lvl + (pt ? " e ganhou 1 ponto de desenvolvimento!" : "."));
  if (dungeon && dungeon.active && dungeon.hero === h) {
    dungeon.hp = Math.min(dungeon.hpMax, dungeon.hp + dungeon.hpMax * 0.2);
    spawnDungeonToast("NÍVEL " + h.lvl + "!", dungeon.px, dungeon.py - 46, "#ffe08a", 16);
    xpBurst(dungeon.px, dungeon.py - 10, "#ffe08a", 18);
    sfx("ping");
    if (pt) {
      spawnDungeonToast("+1 ponto de árvore", dungeon.px, dungeon.py - 66, "#9fe3ff", 13);
      setBanner("📜 Ponto de desenvolvimento!", "Abra a Ficha para escolher um caminho", 3, "#9fe3ff");
    }
  }
}
export function gainSkill(hero: Hero, skillId: string, amount: number) {
  // reescrita na v5.9.05
  if (!hero || !amount) return;
  if (skillId === "espada") skillId = profWeapon(hero);
  if (!hero.skills) hero.skills = {};
  let s = hero.skills[skillId];
  const isNew = !s;
  if (!s) s = hero.skills[skillId] = { level: 1, xp: 0 };
  s.xp += amount;
  const lv0 = s.level,
    lv = profLvOfXp(s.xp);
  s.level = lv;
  if (dungeon.active && dungeon.hero === hero) {
    const base = profNeed(lv),
      next = lv >= PROF_MAX ? base : profNeed(lv + 1);
    progressoEfetivo(skillId, lv, lv >= PROF_MAX ? 0 : s.xp - base, next - base);
  }
  addHeroXp(hero, amount * 0.6);
  const P = PROF_BY[skillId] || { n: skillId, i: "★" };
  if (isNew) pushEvent(hero.name + " começou a treinar " + P.n + ".");
  else if (lv > lv0) {
    pushEvent(P.i + " " + hero.name + " subiu " + P.n + " para o nível " + lv + "!");
    if (dungeon.active && dungeon.hero === hero)
      spawnDungeonToast(P.i + " " + P.n + " Nv." + lv + "!", dungeon.px, dungeon.py - 62, "#ffe08a", 14);
    else
      try {
        mvToast(P.i + " " + hero.name + ": " + P.n + " Nv." + lv);
      } catch (_) {}
    sfx("ping");
  }
}

export function buyNode(h: Hero, id: string) {
  ensureHero(h);
  const n = NODE_BY_ID[id];
  if (!n || nodeState(h, n) !== "open" || treePoints(h) < 1) return false;
  h.nodes[id] = true;
  h.spent++;
  const newSyn = SYNERGIES.filter((s) => s.needs.indexOf(id) >= 0 && s.needs.every((x) => h.nodes[x]));
  pushEvent(h.name + " desenvolveu " + n.name + ".");
  newSyn.forEach((s) => pushEvent("✨ Sinergia descoberta: " + s.name + "!"));
  return newSyn;
}
function heroSpawnPoint() {
  const h0 = world.heroes[0];
  if (h0) {
    const a = world.heroes.length * 1.3;
    return { x: h0.camp.x + Math.cos(a) * 10, y: h0.camp.y + Math.sin(a) * 10 };
  }
  return snapToLand(SPAWN0.x * WORLD_K, SPAWN0.y * WORLD_K);
}
export function createHero(name: string, born?: Nascimento): Hero {
  const camp = heroSpawnPoint();
  const id = "hero-" + Date.now().toString(36) + Math.floor(Math.random() * 1000);
  const color = HERO_COLORS[world.heroes.length % HERO_COLORS.length];
  const bn = born && born.aff ? born : bornFromSeed(newSeed()),
    attrs = { ...bn.attrs },
    visual = sortearAparencia();
  aplicarTendenciaCorporal(attrs, visual.corpo);
  const hpMax = 36 + attrs.constituicao * 6;
  const h: Hero = {
    id,
    name: (name || "Sem nome").slice(0, 18),
    color,
    attrs,
    seed: bn.seed,
    aff: bn.aff,
    gen: bn.gen,
    xp: 0,
    lvl: 1,
    nodes: {},
    spent: 0,
    treeBonus: 0,
    manaMax: 20 + attrs.mana * 4,
    mana: 20 + attrs.mana * 4,
    _rpg: 1,
    aparenciaVersao: 1,
    skills: {},
    camp: { x: camp.x, y: camp.y },
    x: camp.x,
    y: camp.y,
    dir: 0,
    state: "idle",
    task: null,
    targetEntity: null,
    loot: { meat: 0, wood: 0, stone: 0, feather: 0, eagle: 0 },
    trail: [],
    huntTimer: 0,
    localTarget: null,
    huntSpecies: "rabbit",
    huntHours: 6,
    implemented: true,
    hpMax,
    hp: hpMax,
    energy: 100,
    hunger: 0,
  };
  // Corpo e cabeça são sorteados separadamente entre todas as opções femininas.
  h.visual = visual;
  world.heroes.push(h);
  pushEvent(h.name + " chegou ao acampamento, pronto pra começar.");
  return h;
}

/** Pequenas tendências físicas: redistribuem pontos do nascimento sem alterar o total de atributos. */
export function aplicarTendenciaCorporal(attrs: Attrs, corpo: string) {
  const tendencias: Record<string, [string, string, string, string]> = {
    corpo_f02: ["forca", "constituicao", "mana", "destreza"], // atlética: potência e resistência
    corpo_f04: ["velocidade", "destreza", "forca", "constituicao"], // delicada: agilidade
    corpo_f01: ["velocidade", "destreza", "constituicao", "forca"], // esbelta: mobilidade
    corpo_f06: ["forca", "constituicao", "velocidade", "mana"], // voluptuosa: vigor
    corpo_f03: ["constituicao", "forca", "velocidade", "mana"], // curvilínea: vigor
  };
  const tendencia = tendencias[corpo];
  if (!tendencia) return;
  const [ganha1, ganha2, perde1, perde2] = tendencia;
  attrs[ganha1] = (attrs[ganha1] ?? 5) + 1;
  attrs[ganha2] = (attrs[ganha2] ?? 5) + 1;
  attrs[perde1] = (attrs[perde1] ?? 5) - 1;
  attrs[perde2] = (attrs[perde2] ?? 5) - 1;
}
