/* ==== Fase 4 — acertos no bicho: faíscas, sensação de dano, ferir e matar (base/16) ==== */
import { consumirFolegoExterno, defesaFolego } from "./folego.ts";
import { topoCanto } from "./rastreio.ts";
import { D3, d3Shift } from "./projecao.ts";
import { MOB, mobAim } from "../ui/celular.ts";
import { dungeon, TELAS, econ, OPT } from "../core/state.ts";
import {
  sfx,
  somPuxarCorda,
  shakeScreen,
  addRing,
  xpBurst,
  spawnLoot,
  knockApart,
  addSwordPts,
  dungeonDeath,
  addBowPts,
  parryNaChegada,
} from "./chao.ts";
import {
  spawnDungeonToast,
  onMonsterKilled,
  reveal,
  setBanner,
  spawnDungeonMonster,
  dSafe,
  killBird,
} from "./masmorra.ts";
import { DMG, mixOfKey, aplicarDano, monProf, isMonstro, penDe } from "./dano.ts";
import { CRIT_SP } from "../data/campo.ts";
import { CRIT, loboBravo, critAI, loboAI } from "./campo_vida.ts";
import {
  AREA,
  FIN,
  knifeMode,
  knifeSlash,
  areaWrap,
  knifeActive,
  withBagKnife,
  applyStunRaw,
  ropeTug,
} from "./faca_corda.ts";
import { KNIFE_KEYS, COMBO, COMBO_WINDOW, WEAPONS, POUNCE_LOCK, ALFA, ARCO_FOL, ARCO_BASICO } from "../data/combate.ts";
import {
  dmgKeyFor,
  danoEfeitos,
  cravPress,
  folTick,
  stickTick,
  folWake,
  arrowStick,
  folVel,
  folFugindo,
} from "./tipos.ts";
import { ISC } from "../intro/cena.ts";
import { STAT } from "../data/atributos.ts";
import { pushEvent } from "../sim/eventos.ts";
import { critChance, forMult, mastMult, attrOf, bowBaseDmg } from "../hero/atributos.ts";
import { eqWear, eqWeaponMult, eqBlockMult, eqWearArmor, eqBowMult } from "../items/durabilidade.ts";
import {
  markMult,
  applyStun,
  applyBleed,
  atkSpeedMult,
  HERO,
  applySlow,
  onBlockOk,
  hurtPlayer,
  marcarCombateHumano,
  bleedTick,
  wolfTactics,
} from "./combate.ts";
import { gainSkill, ensureHero } from "../hero/nivel.ts";
import { trainRecord } from "./treino.ts";
import { survDmgMult, survMoveMult } from "../survival/sobrevivencia.ts";
import { profLv, profWeapon } from "../hero/proficiencias.ts";
import { ITEM_DEFS } from "../data/itens.ts";
import { drawSprite, refillQuiver } from "../render/sprites.ts";
import { ensureEquip, armorRed } from "../items/equipamento.ts";
import {
  spearStuckNear,
  spearPull,
  wpnProf,
  hvKind,
  hvStart,
  bowEvade,
  spearParry,
  bowQuickCheck,
  gingaDesvia,
} from "./armas.ts";
import { nv } from "../hero/arvores.ts";
import { angDiff } from "../core/util.ts";
import { SURV } from "../data/sobrevivencia.ts";
import { boarAI, boarTrombou } from "../creatures/javali.ts";
import { BOAR_ARVORE } from "../data/especies.ts";
import { BANDO } from "../data/bandidos.ts";
import { mundoMover } from "../map/mundo.ts";
import { bandidoAI, bandidoBloqueia, bandidoCaiu } from "./bandidos.ts";
import { BIRD_LUCK } from "../data/expedicao.ts";
import type { Aparo, Hero, Monster, Repasse } from "../core/tipos.ts";

export function monR(m: Monster) {
  return m.boss ? 22 : 13;
} // raio do corpo (sprite 32/58 px)
/** v8.1 — o peso do seu golpe ao acertar: a congelada (s) no 3º do combo, no golpe de perto e no de longe, e o tremor (px). */
const IMPACTO_SENTIDO = { congelaFin: 0.11, congela: 0.075, congelaLonge: 0.04, tremeFin: 5, treme: 3 };
/** v8.1 — o raio do corpo de um humano para os acertos: em pé e caído (px do campo). */
const CORPO_HUMANO = { pe: 10, caido: 9 };
/** O meio do corpo (onde vão o anel de foco e o que aponta para ele): o do caído fica no corpo deitado. */
export function centroCorpo(m: Monster) {
  const B = wolfBody(m);
  return m.humano ? { x: (B.ax + B.bx) / 2, y: (B.ay + B.by) / 2 } : { x: m.x, y: m.y };
}
export function wolfBody(m: Monster) {
  // corpo do lobo para acertos: no 3D é uma cápsula do rabo/quadril até a cabeça, girando junto com o modelo
  if (!(D3.gl && m._yaw != null)) return { ax: m.x, ay: m.y, bx: m.x, by: m.y, r: monR(m) };
  // v8.1 — humano: em pé, um cilindro no corpo (não o lobo deitado); caído, a linha do quadril à cabeça da pose da queda
  // (render/gl/bandidos_gl.ts mede): o golpe no corpo deitado conta (antes só contava perto dos pés)
  if (m.humano) {
    const c = m.ko! > 0 ? m.corpoCaido : null;
    if (c) return { ax: c[0], ay: c[1], bx: c[2], by: c[3], r: CORPO_HUMANO.caido };
    return { ax: m.x, ay: m.y, bx: m.x, by: m.y, r: CORPO_HUMANO.pe };
  }
  const sc = m.boss ? 1.65 : m.big || 0.95,
    cx = Math.cos(m._yaw),
    cy = Math.sin(m._yaw),
    b0 = -13 * sc,
    b1 = 21 * sc;
  return { ax: m.x + cx * b0, ay: m.y + cy * b0, bx: m.x + cx * b1, by: m.y + cy * b1, r: 7 * sc + 2 };
}

export function aimAngle() {
  // A carga básica da clava acompanha o inimigo; especiais continuam mirando no mouse.
  const auto = dungeon.alvoAutomatico;
  // v8.1: a puxada do básico do arco também (o percurso no chão vai até o alvo)
  if (auto?.alive && ((dungeon.hv?.kind === "clubL" && !dungeon.especialPressionado) || puxandoBasico())) {
    const q = bodyDist(wolfBody(auto), dungeon.px, dungeon.py);
    return Math.atan2(q.y - dungeon.py, q.x - dungeon.px);
  }
  if (MOB.on && !dungeon.mouse) {
    const _a = mobAim();
    if (_a != null) return _a;
  }
  const m = dungeon.mouse;
  if (m) return Math.atan2(m.y - dungeon.py, m.x - dungeon.px);
  const t = dungeon.target;
  if (t && t.alive) return Math.atan2(t.y - dungeon.py, t.x - dungeon.px);
  return 0;
}

/* ===== v3.6.7: sensação de dano no lobo (visual + sonoro) ===== */
export function hitSparks(x: number, y: number, ang: number, n: number, heavy: boolean) {
  const arr = dungeon.sparks || (dungeon.sparks = []);
  for (let i = 0; i < n; i++) {
    const a = ang + (Math.random() - 0.5) * 1.6,
      sp = 60 + Math.random() * (heavy ? 200 : 120);
    arr.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      t: 0,
      life: 0.28 + Math.random() * 0.26,
      col: Math.random() < 0.72 ? (Math.random() < 0.5 ? "#d23b3b" : "#8a1c24") : "#fff1c9",
      r: 1.2 + Math.random() * (heavy ? 2.3 : 1.5),
    });
  }
}
function hitFeel(m: Monster, dmg: number, skill: string, dot: boolean) {
  const d = dungeon;
  if (m.hp <= 0) return;
  if (dot) {
    m.flash = Math.max(m.flash || 0, 0.05);
    return;
  }
  const recent = d.lastStepAt && performance.now() - d.lastStepAt < 120,
    melee = skill === "espada";
  const fin = melee && ((recent && d.lastStep === 2) || (!recent && dmg >= 5.5)),
    ang = Math.atan2(m.y - d.py, m.x - d.px);
  if (m.bandido) {
    // v8.1: o bandido não perde o golpe a cada pancada (só no 3º do combo, logo abaixo, como o lobo)
    if (m.st !== "windup") m.humanoAtingidoT = 0;
  } else if (m.humano) {
    m.humanoAtingidoT = 0;
    m.humanoGolpeT = undefined;
    if (m.st === "windup") {
      m.st = "recover";
      m.t = Math.max(m.t || 0, 0.22);
    }
  }
  m.flash = fin ? 0.18 : 0.12;
  m.hitT = fin ? 0.24 : 0.17;
  m.hitAng = ang;
  if (!m.boss && !fin) {
    const kb = melee ? 9 : 5;
    m.kx = (m.kx || 0) + Math.cos(ang) * kb * 9;
    m.ky = (m.ky || 0) + Math.sin(ang) * kb * 9;
  } // recuo de cada golpe
  const cc = centroCorpo(m); // v8.1: no corpo (o humano caído: no corpo deitado)
  hitSparks(cc.x, cc.y, ang, fin ? 15 : 9, fin);
  (d.cuts || (d.cuts = [])).push({
    x: cc.x,
    y: cc.y,
    ang: ang + (Math.random() < 0.5 ? 1 : -1) * (1.1 + Math.random() * 0.5),
    life: 0.16,
    big: fin,
  }); // risco do corte sobre o lobo
  // congelada rápida no impacto (v8.1: mais longa, o golpe "pesa" mais; mantenedor: "o jogo precisa responder mais")
  d.hitStop = Math.max(
    d.hitStop || 0,
    fin ? IMPACTO_SENTIDO.congelaFin : melee ? IMPACTO_SENTIDO.congela : IMPACTO_SENTIDO.congelaLonge,
  );
  shakeScreen(fin ? 0.18 : 0.1, fin ? IMPACTO_SENTIDO.tremeFin : IMPACTO_SENTIDO.treme);
  sfx(fin ? "hit3" : melee ? "hit" : "hitlite");
  // o 3º golpe do combo interrompe o golpe do lobo (v8.0: só ele; um golpe isolado forte não, senão com a perícia alta
  // quase todo golpe interrompia, e o impacto tem a própria regra: DANO.IMPACTO.minEfeito)
  if (fin && recent && d.lastStep === 2 && !m.boss && m.st === "windup") {
    m.st = "recover";
    m.t = 0.55;
    m.parry = null;
    if (!m.humano) spawnDungeonToast("Atordoou!", m.x, m.y - 30, "#9fe3ff", 13);
  }
}
function killFeel(m: Monster) {
  /* v6.8 */
  if (m && m.critter) {
    const d = dungeon;
    addRing(m.x, m.y, "#d23b3b", 26, 0.35, 3);
    d.hitStop = Math.max(d.hitStop || 0, 0.06);
    sfx("hit");
    return;
  }
  const d = dungeon,
    ang = Math.atan2(m.y - d.py, m.x - d.px);
  hitSparks(m.x, m.y, ang, m.boss ? 40 : 24, true);
  addRing(m.x, m.y, "#d23b3b", m.boss ? 80 : 44, 0.4, 4);
  // o lobo some "voando"; a pessoa fica caída (v8.1: bandidos.ts CAIDOS)
  if (!m.humano)
    (d.ghosts || (d.ghosts = [])).push({ x: m.x, y: m.y, coat: m.coat || 0, boss: !!m.boss, ang, life: 0.5, max: 0.5 });
  d.hitStop = Math.max(d.hitStop || 0, m.boss ? 0.2 : 0.12);
  shakeScreen(m.boss ? 0.45 : 0.22, m.boss ? 9 : 5);
  sfx("wolfdie");
}
export function hurtMonster(m: Monster, dmg: number, skill: string, xp: number, dot?: boolean) {
  /* v7.3 — golpe em área: guarda os acertos para aplicar divididos no fim do golpe (ver areaWrap) */
  if (AREA.q && !dot) {
    AREA.q.push([m, dmg, skill, xp, DMG.src, DMG.key]);
    return;
  }
  if (!dot && dmg > 0) marcarCombateHumano(m);
  /* v7.7 — o Alfa toma menos dano (ALFA.dano); o golpe do finalizador nele já vem medido (FIN.on) */
  if (m && m.boss && dmg > 0 && !FIN.on) dmg *= ALFA.dano;
  /* v7.7 — o bicho que você fere (golpe direto, não sangramento/veneno) vira o alvo prioritário; o foco não muda */
  if (m && m.alive && !m.dummy && !dot && dmg > 0 && dungeon.target !== m) dungeon.target = m;
  /* v7.0 — bicho do Campo: um tiro só tira até uma parte da vida e deixa ferido */
  {
    const S = m && m.critter && CRIT_SP[m.sp!];
    if (S && S.tiroMax && !dot && !(m.ko! > 0) && !(typeof FIN !== "undefined" && FIN.on) && dmg > 0) {
      dmg = Math.min(dmg, S.tiroMax * m.hpMax);
      m.ferido = S.ferido;
    }
  }
  /* v6.8 — bater num bicho neutro: coelho/cervo se assusta; lobo neutro fica bravo */
  if (m && m.neutral && !dot) loboBravo(m);
  if (!m || !m.critter) return hurtMonsterTipos(m, dmg, skill, xp, dot);
  m.scared = 4;
  CRIT.cur = m;
  try {
    return hurtMonsterTipos(m, dmg, skill, xp, dot);
  } finally {
    CRIT.cur = null;
  }
}
/* v6.2 — tipos de dano: perfura/corta/impacta contra a resistência do bicho, e os efeitos de cada tipo */
function hurtMonsterTipos(m: Monster, dmg: number, skill: string, xp: number, dot?: boolean) {
  if (dot || !m || !(dmg > 0) || (typeof FIN !== "undefined" && FIN.on) || m.kind === "bird")
    return hurtMonsterBase(m, dmg, skill, xp, dot);
  let r, mix, key;
  try {
    key = dmgKeyFor(skill);
    mix = mixOfKey(key);
    r = aplicarDano(dmg, mix, monProf(m).res, penDe(key, mix));
    DMG.last = { m, parts: r.parts, mix, key, base: dmg, total: r.total };
  } catch (e) {
    return hurtMonsterBase(m, dmg, skill, xp, dot);
  }
  hurtMonsterBase(m, r.total, skill, xp, dot);
  try {
    danoEfeitos(m, r, mix, key, skill);
  } catch (e) {
    console.warn("dano", e);
  }
}
function hurtMonsterBase(m: Monster, dmg: number, skill: string, xp: number, dot?: boolean) {
  if (m?.humano && !dot && (m.humanoInvuln || 0) > 0) {
    spawnDungeonToast("Esquivou", m.x, m.y - 30, "#9fe3ff", 12);
    addRing(m.x, m.y, "#9fe3ff", 30, 0.24, 2);
    m.humanoInvuln = 0;
    return;
  }
  /* v6.1 — o javali da cena inicial não morre antes da hora */
  if (ISC.on && m && m.intro) {
    const floor = m.hpMax * 0.42;
    if (m.hp - dmg < floor) dmg = Math.max(0, m.hp - floor);
    if (!dot) ISC.hits++;
  }
  /* v5.9.01 — bicho caído leva +30% */
  if (m && m.downT! > 0 && !dot) dmg *= 1.3;
  if (m?.bandido && !dot && (m.humanoGuardT || 0) > 0) {
    if (bandidoBloqueia(m)) dmg *= 1 - 0.7 * defesaFolego(m); // v8.1: de frente; o golpe carregado quebra a guarda
  } else if (m?.humano && !dot && (m.humanoGuardT || 0) > 0) {
    dmg *= 1 - 0.65 * defesaFolego(m);
    m.humanoFolego = Math.max(0, (m.humanoFolego || 0) - 8);
    spawnDungeonToast("Bloqueou", m.x, m.y - 30, "#9fe3ff", 11);
  }
  /* v5.0 — crítico em todo golpe direto; boneco da sala de treino */
  const d = dungeon,
    h = d.hero!;
  let crit = false;
  if (
    !dot &&
    m &&
    m.kind !== "bird" &&
    (skill === "espada" || skill === "arco") &&
    h &&
    Math.random() < critChance(h)
  ) {
    crit = true;
    dmg *= STAT.critMult;
  }
  if (d.training) xp = 0;
  const hp0 = m ? m.hp : 0;
  if (crit) m.flash = 0.2;
  d._dmgTgt = m;
  d._dmgDot = !!dot;
  d._dmgCrit = crit;
  d._lastCrit = !!crit;
  try {
    if (skill === "espada" && !dot && m && m.kind !== "bird" && m.alive) eqWear("maoD", 1);
    {
      const _mk = dot ? 1 : markMult(m);
      if (_mk > 1) {
        dmg *= _mk;
        spawnDungeonToast("Marcado x" + _mk.toFixed(2).replace(/0$/, "").replace(".", ","), m.x, m.y - 30, "#ffe08a");
      }
    }
    m.hp -= dmg;
    // (v8.1: o bandido cai pelo fôlego, como os bichos, e com pouca vida foge ou luta até a morte: bandidos.ts)
    if (m.humano && !m.bandido && !FIN.on && m.hp <= m.hpMax * 0.25) {
      m.hp = Math.max(1, m.hp);
      m.ko = Math.max(m.ko || 0, 8);
      m.downT = Math.max(m.downT || 0, 8);
      m.st = "recover";
      m.t = 0.3;
      spawnDungeonToast("Humano vulnerável · E para finalizar", m.x, m.y - 38, "#ffd477", 13);
    }
    if (xp > 0) {
      gainSkill(h, skill, xp);
      if (skill === "arco") xpBurst(m.x, m.y, "#9fe3ff", 4 + xp * 2);
    }
    const dmgVisivel = Math.round(dmg);
    if (dmgVisivel > 0) {
      if (dot) spawnDungeonToast("-" + dmgVisivel, m.x + (Math.random() - 0.5) * 8, m.y - 14, "#e05a5a", 10);
      else {
        const _hv = dmg >= 4.5;
        spawnDungeonToast(
          "-" + dmgVisivel,
          m.x + (Math.random() - 0.5) * 12,
          m.y - 14,
          _hv ? "#ffd24a" : "#ffb37a",
          _hv ? 14 : 11,
        );
      }
    }
    hitFeel(m, dmg, skill, dot!);
    if (
      !dot &&
      m.alive &&
      !m.boss &&
      !m.humano &&
      m.st === "chase" &&
      m.low !== "frenzy" &&
      !(m.fleeT! > 0) &&
      Math.random() < 0.35
    ) {
      m.retreat = 0.35 + Math.random() * 0.3;
      m.hop = 0.3;
    }
    if (m.hp <= 0) {
      killFeel(m);
      m.alive = false;
      if (dungeon.target === m) dungeon.target = null;
      if (m.bandido)
        bandidoCaiu(m); // v8.1: ouro, às vezes a arma, e o corpo no chão
      else spawnLoot(m.x, m.y, true, m.boss);
      const nomeDerrotado = m.bandido
        ? "Bandido"
        : m.humano
          ? "Parceiro"
          : m.kind === "javalino"
            ? "Javali"
            : m.boss
              ? "Lobo Alfa"
              : "Lobo";
      spawnDungeonToast(nomeDerrotado + " derrotado!", m.x, m.y, "#ffe08a");
      pushEvent(
        h.name +
          (m.bandido
            ? " derrotou um " + m.name.toLowerCase() + "."
            : m.humano
              ? " finalizou o parceiro de treino."
              : m.kind === "javalino"
                ? " derrotou um javali."
                : m.boss
                  ? " derrotou o Lobo Alfa!"
                  : " derrotou um lobo da masmorra."),
      );
      onMonsterKilled(m);
    }
  } finally {
    d._dmgTgt = null;
    d._dmgDot = false;
    d._dmgCrit = false;
  }
  if (m && m.dummy) {
    const dealt = hp0 - m.hp;
    m.hp = m.hpMax;
    m.alive = true;
    m.wob = Math.min(1, (m.wob || 0) + 0.5 + Math.min(0.5, dealt / 30));
    m.wobA = Math.atan2(m.y - d.py, m.x - d.px);
    trainRecord(dealt, crit, dot!, skill);
  }
}
export function meleeDmg(h: Hero) {
  /* v5.9 */
  return meleeDmgBase(h) * (dungeon.active && dungeon.hero === h ? survDmgMult() : 1);
}
// etapa de meleeDmg: reescrita na v5.0
function meleeDmgBase(h: Hero) {
  return eqWeaponMult(h) * (2 + Math.random() * 1.2) * forMult(h) * mastMult(profLv(h, profWeapon(h)));
}
export function rollItemKey() {
  let r = Math.random() * Object.values(ITEM_DEFS).reduce((a, d) => a + (d.w || 0), 0);
  for (const k in ITEM_DEFS) {
    r -= ITEM_DEFS[k].w;
    if (r <= 0) return k;
  }
  return "carne";
}

export function drawHitFx(dt: number) {
  const c = TELAS.dCtx,
    d = dungeon;
  for (let i = (d.ghosts || []).length - 1; i >= 0; i--) {
    // lobo some "voando" para trás
    const g = d.ghosts![i];
    g.life -= dt;
    if (g.life <= 0) {
      d.ghosts!.splice(i, 1);
      continue;
    }
    const k = 1 - g.life / g.max,
      sz = (g.boss ? 58 : 32) * (1 + 0.15 * k);
    if (!D3.gl)
      drawSprite(
        "wolf",
        "M",
        g.coat,
        g.x + Math.cos(g.ang) * 18 * k,
        g.y + Math.sin(g.ang) * 18 * k,
        sz,
        Math.max(0, g.life / g.max) * 0.8,
        null,
        c,
      );
  }
  c.save();
  if (D3.on) d3Shift(c, 14);
  for (let i = (d.sparks || []).length - 1; i >= 0; i--) {
    const p = d.sparks![i];
    p.t += dt;
    if (p.t > p.life) {
      d.sparks!.splice(i, 1);
      continue;
    }
    const k = Math.pow(0.03, dt);
    p.vx *= k;
    p.vy *= k;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    c.globalAlpha = 1 - p.t / p.life;
    c.fillStyle = p.col;
    c.beginPath();
    c.arc(p.x, p.y, p.r * (1 - (0.4 * p.t) / p.life), 0, 7);
    c.fill();
  }
  c.globalAlpha = 1;
  for (let i = (d.cuts || []).length - 1; i >= 0; i--) {
    const q = d.cuts![i];
    q.life -= dt;
    if (q.life <= 0) {
      d.cuts!.splice(i, 1);
      continue;
    }
    const len = q.big ? 22 : 14,
      a = Math.min(1, q.life / 0.16);
    c.save();
    c.lineCap = "round";
    c.strokeStyle = "rgba(255,248,220," + a + ")";
    c.lineWidth = q.big ? 4 : 2.4;
    c.beginPath();
    c.moveTo(q.x - Math.cos(q.ang) * len, q.y - Math.sin(q.ang) * len);
    c.lineTo(q.x + Math.cos(q.ang) * len, q.y + Math.sin(q.ang) * len);
    c.stroke();
    c.restore();
  }
  c.restore();
}
export function bodyDist(B: ReturnType<typeof wolfBody>, x: number, y: number) {
  // distância de um ponto até o corpo (e o ponto do corpo mais próximo)
  const vx = B.bx - B.ax,
    vy = B.by - B.ay,
    l2 = vx * vx + vy * vy;
  let t = l2 ? ((x - B.ax) * vx + (y - B.ay) * vy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = B.ax + vx * t,
    qy = B.ay + vy * t;
  return { d: Math.hypot(x - qx, y - qy), x: qx, y: qy };
}
export function swingBasic() {
  // 1 clique = 1 golpe na direção do mouse (não precisa marcar alvo)
  /* v7.3 — com a faca vira o corte em cone; os outros golpes dividem o dano entre os alvos (ver areaWrap) */
  const d = dungeon;
  if (d.crav || d.noAtk! > 0) return swingBasicGolpe();
  if (knifeMode()) return knifeSlash();
  return swingBasicArea();
}
const swingBasicArea = areaWrap(swingBasicGolpe);
function swingBasicGolpe() {
  const d = dungeon,
    h = d.hero;
  /* v6.2 — arma cravada: o clique segura/empurra; o golpe marca a origem do dano (o que pode cravar) */
  if (d.crav) {
    cravPress();
    return;
  }
  if (d.noAtk! > 0) return;
  const o = DMG.src;
  DMG.src = "swing";
  try {
    /* v6.1.3 — faca: sempre estocada rápida (sem o 3º golpe largo da espada) */
    if (
      h &&
      d.weapon === "melee" &&
      !d.spearOut &&
      knifeActive(h) &&
      (!ensureEquip(h).maoD || KNIFE_KEYS.includes(ensureEquip(h).maoD!.def.key))
    ) {
      d.combo = (d.combo || 0) % 2;
      d.riposte = 0;
    }
    /* v6.1.2 — de mãos vazias, usa a faca da mochila */
    return withBagKnife(() => swingBasicBase());
  } finally {
    DMG.src = o;
  }
}
function swingBasicBase() {
  const d = dungeon;
  /* v5.9.02 — clava: o golpe básico também é carregado */
  if (d.active && d.weapon === "melee" && hvKind("L") === "clubL" && ensureEquip(d.hero!).maoD) {
    hvStart("clubL");
    return;
  }
  /* v5.9.01 — de mãos vazias perto da lança cravada: puxa a lança */
  if (d.active && !d.dead && d.weapon === "melee" && !(d.cd! > 0) && !ensureEquip(d.hero!).maoD) {
    const s = spearStuckNear();
    if (s) {
      spearPull(s);
      return;
    }
  }
  /* v5.8 — caído não ataca */
  if (d.down! > 0) return;
  if (
    !d.active ||
    d.dead ||
    d.invOpen ||
    d.craftOpen ||
    d.modalOpen ||
    d.weapon !== "melee" ||
    d.guard ||
    d.cd! > 0 ||
    d.parryVis! > 0
  )
    return;
  const h = d.hero!,
    T = d.tile;
  if (!(d.comboT! > 0)) d.combo = 0;
  let step = d.combo! % 3;
  if (d.riposte! > 0) {
    step = 2;
    d.riposte = 0;
    spawnDungeonToast("CONTRA-GOLPE!", d.px, d.py - 40, "#ffe08a", 14);
  }
  const st = COMBO[step],
    ang = aimAngle(),
    W = wpnProf(h);
  if (d.spearOut && !ensureEquip(h).maoD) {
    spawnDungeonToast("Busque a lança 🔱", d.px, d.py - 30, "#ffe08a", 11);
    d.cd = 0.3;
    return;
  }
  d.cd = st.cd * atkSpeedMult() * W.cd;
  d.cdMax = d.cd;
  reveal();
  d.slash = {
    ang,
    life: 0.2,
    step,
    half: st.half * W.half,
    reach: st.reach * W.reach,
    ox: d.px,
    oy: d.py,
    thrust: !!W.thrust,
  };
  d.lastStep = step;
  d.lastStepAt = performance.now();
  sfx("swing");
  const lm = nv(h, "est_fogo", 1),
    lx = Math.cos(ang) * st.lunge * lm * W.lunge,
    ly = Math.sin(ang) * st.lunge * lm * W.lunge; // pequeno avanço junto com o golpe
  d.px = Math.max(T, Math.min(d.cols * T - T, d.px + lx));
  d.py = Math.max(T, Math.min(d.rows * T - T, d.py + ly));
  d.moveTarget = null;
  d.slash.ox = d.px;
  d.slash.oy = d.py;
  let hits = 0;
  for (const m of d.monsters) {
    if (!m.alive) continue;
    const _B = wolfBody(m),
      _q = bodyDist(_B, d.px, d.py),
      dx = _q.x - d.px,
      dy = _q.y - d.py,
      dist = Math.hypot(dx, dy);
    const mr = _B.r; // acerta se o CORPO do lobo toca a fatia desenhada
    if (dist - mr > T * st.reach * W.reach) continue;
    if (dist > mr && angDiff(Math.atan2(dy, dx), ang) > st.half * W.half + Math.asin(Math.min(1, mr / dist))) continue;
    let dmg = meleeDmg(h) * st.mult * W.mult;
    if (m.st === "recover") {
      dmg *= 1.7;
      spawnDungeonToast("Contra-ataque!", m.x, m.y - 28, "#9fe3ff");
    }
    d.fx!.push({ x: m.x, y: m.y, life: 0.25 });
    if (st.kb || W.thrust) knockApart(m, W.thrust ? 11 : st.kb * W.kb, W.thrust ? 4 : 6);
    hurtMonster(m, dmg, "espada", 3);
    hits++;
    if (m.alive && W.stun && Math.random() < W.stun) {
      applyStun(m, 0.9);
      spawnDungeonToast("💫", m.x, m.y - 30, "#ffe08a", 18);
    }
    if (m.alive && W.bleed && Math.random() < W.bleed) {
      applyBleed(m, dmg * 0.6);
      spawnDungeonToast("🩸", m.x, m.y - 30, "#ff6a6a", 16);
    }
  }
  if (hits) addSwordPts(step === 2 ? 2 + hits : 1);
  d.combo = step + 1;
  d.comboT = COMBO_WINDOW;
  if (step === 2) {
    d.combo = 0;
    d.comboT = 0;
    if (hits) {
      shakeScreen(0.12, 3);
      spawnDungeonToast("COMBO x3!", d.px, d.py - 36, "#ffe08a");
    }
  }
}
export function dungeonAttack() {
  if (!dungeon.active) return;
  if (dungeon.weapon === "melee") {
    swingBasic();
    return;
  }
  const h = dungeon.hero!,
    m = dungeon.target,
    T = dungeon.tile,
    px = dungeon.px,
    py = dungeon.py;
  const say = (t: string) => spawnDungeonToast(t, px, py - 24, "#fff8e3");
  if (dungeon.weapon === "bow" || dungeon.guard) return;
  if (!m || !m.alive) {
    say("Marque um alvo (clique no lobo)");
    return;
  }
  if (m.kind === "bird") {
    say("Pássaro: use o arco");
    return;
  }
  if (dungeon.cd! > 0) return;
  const d = Math.hypot(m.x - px, m.y - py),
    w = WEAPONS[dungeon.weapon!];
  if (dungeon.weapon === "melee") {
    if (d > T * w.reach!) {
      say("Longe demais");
      return;
    }
    dungeon.cd = w.cd;
    reveal();
    dungeon.slash = { ang: Math.atan2(m.y - py, m.x - px), life: 0.18 };
    let dmg = meleeDmg(h);
    if (m.st === "recover") {
      dmg *= 1.7;
      spawnDungeonToast("Contra-ataque!", m.x, m.y - 28, "#9fe3ff");
    }
    dungeon.fx!.push({ x: m.x, y: m.y, life: 0.25 });
    hurtMonster(m, dmg, "espada", 3);
  } else {
    return; /* arco é tratado por startCharge/fireArrow */
    if (d > T * w.range!) {
      say("Fora de alcance");
      return;
    }
    dungeon.cd = w.cd;
    const ang = Math.atan2(m!.y - py, m!.x - px),
      arcoLv = (h.skills.arco && h.skills.arco.level) || 0;
    dungeon.arrows!.push({
      x: px,
      y: py,
      vx: Math.cos(ang) * 300,
      vy: Math.sin(ang) * 300,
      life: (T * w.range!) / 300 + 0.3,
      dmg: 4 + arcoLv * 1.2 + h.attrs.forca * 0.3 + Math.random() * 3,
    });
  }
}
export function parryTouches(m: Monster) {
  // o círculo do lobo toca a fatia do último parry (a fatia continua desenhada ~0,25s)
  const a = dungeon.parryArc,
    T = dungeon.tile;
  if (!a) return false;
  const rg = m.st === "leap" ? T * 0.85 : T * (m.boss ? 1.25 : 0.95),
    dd = Math.hypot(m.x - a.x, m.y - a.y);
  return (
    dd - rg <= T * 0.9 &&
    (dd <= rg || angDiff(Math.atan2(m.y - a.y, m.x - a.x), a.ang) <= 1.3 + Math.asin(Math.min(1, rg / dd)))
  );
}
export function wolfStrike(this: unknown, m: Monster, _pr?: Aparo | null, _base?: number, _rec?: number) {
  // os outros vão por `arguments` para wolfStrikeBase
  /* v6.2 — armorRed continua devolvendo um número (o resto do jogo usa assim): dentro de um ataque usa o perfil do bicho; fora, a média */
  const o = DMG.att;
  DMG.att = m;
  try {
    return wolfStrikeBase.apply(this, arguments as Repasse);
  } finally {
    DMG.att = o;
  }
}
// etapa de wolfStrike: original
function wolfStrikeBase(m: Monster, pr: Aparo | null | undefined, base: number, rec: number) {
  // resolve um golpe que acertou (mordida ou bote): parry, defesa, dano
  const h = dungeon.hero!;
  if (dungeon.dead) return rec;
  // v8.0: a janela de parry aberta e o golpe de frente: avaliado agora, na chegada (chao.ts, parryNaChegada); antes da
  // invulnerabilidade, para o 2º lobo da mesma janela também ser aparado
  {
    const ap = parryNaChegada(m);
    if (ap && "perfeito" in ap) return Math.max(rec || 0, ap.perfeito);
    if (ap) pr = ap;
  }
  if (dungeon.invuln! > 0) {
    spawnDungeonToast("Invulnerável!", dungeon.px, dungeon.py - 34, "#ffe08a");
    return rec;
  }
  if (dungeon.rollGuard! > 0) {
    bowEvade(m);
    return rec;
  }
  if (dungeon.gingaGuard! > 0) {
    gingaDesvia(m); // v7.7: ginga no tempo certo
    return rec;
  }
  let dmg = Math.max(
    1,
    Math.round(
      (base * (dungeon.training ? 1 : SURV.wolfDmg) - attrOf(ensureHero(h), "constituicao") * STAT.conDef) *
        (m.dm || 1) *
        (1 - armorRed(h)),
    ),
  );
  const ang = Math.atan2(m.y - dungeon.py, m.x - dungeon.px),
    diff = Math.abs(Math.atan2(Math.sin(ang - aimAngle()), Math.cos(ang - aimAngle())));
  if (pr && pr.kind === "near") {
    dmg = Math.max(1, Math.round(dmg * 0.4));
    knockApart(m, 24, 8);
    applySlow(m, 0.9);
    addSwordPts(1);
    addRing(m.x, m.y, "#ffb347", 34, 0.3, 3);
    shakeScreen(0.14, 3);
    sfx("near");
    spawnDungeonToast("Parry parcial", dungeon.px, dungeon.py - 34, "#ffb347", 11);
  } else if (pr && (pr.kind === "fail" || pr.kind === "weak")) {
    dmg = Math.max(1, Math.round(dmg * 0.7));
    spawnDungeonToast("Defesa fraca −30%", dungeon.px, dungeon.py - 34, "#ffcf9a", 13);
    sfx("fail");
  } else if (dungeon.dodgeGuard! > 0 && diff < 1.7) {
    dmg = 0;
    spearParry(m, m.st === "leap");
    rec = Math.max(rec || 0, 0.8);
  } else if (dungeon.weapon === "melee" && dungeon.guard && !(dungeon.guardBroken! > 0)) {
    if (diff < 1.3 && m.quebraGuarda) {
      // v8.1: o golpe pesado do bandido não para no escudo: quebra a guarda e passa parte do dano
      dmg = Math.max(1, Math.round(dmg * BANDO.pesadoQuebraGuarda));
      dungeon.gstam = Math.max(0, (dungeon.gstam || 0) - 30);
      dungeon.guard = false;
      dungeon.guardBroken = 1.5;
      spawnDungeonToast("Guarda quebrou!", dungeon.px, dungeon.py - 48, "#ff9a9a", 13);
      sfx("guardbreak");
      shakeScreen(0.2, 4);
    } else if (diff < 1.3) {
      // escudo de frente: nenhum dano, o lobo bate e recua; custa fôlego
      const full = dmg,
        leap = m.st === "leap";
      dmg = 0;
      knockApart(m, leap ? 22 : 12, 1.5);
      onBlockOk(m);
      eqWear("maoE", 1);
      addSwordPts(1);
      rec = Math.max(rec || 0, leap ? 1.1 : 0.7);
      if (leap) {
        m.lx = m.x;
        m.ly = m.y;
      } // o bote para no escudo
      addRing(dungeon.px + Math.cos(aimAngle()) * 16, dungeon.py + Math.sin(aimAngle()) * 16, "#9fe3ff", 22, 0.25, 2);
      shakeScreen(0.08, 1.6);
      sfx("block");
      dungeon._blqEm = performance.now(); // v7.7: a heroína animada toca o "block" (renderer → animado.ts)
      spawnDungeonToast("Bloqueado", dungeon.px, dungeon.py - 32, "#9fe3ff", 11);
      dungeon.gstam! -= (leap ? 30 : 18) * (m.boss ? 1.5 : 1) * nv(HERO()!, "est_terra", 1) * eqBlockMult(h);
      dungeon.gregen = 0.8;
      if (dungeon.gstam! <= 0) {
        dungeon.gstam = 0;
        dungeon.guard = false;
        dungeon.guardBroken = 1.5;
        dmg = Math.max(1, Math.round(full * 0.5));
        spawnDungeonToast("Guarda quebrou!", dungeon.px, dungeon.py - 48, "#ff9a9a", 12);
        sfx("guardbreak");
      }
    } else spawnDungeonToast("Pelas costas!", dungeon.px, dungeon.py - 30, "#ff9a9a");
  }
  if (dmg > 0) {
    hurtPlayer(dmg, ang, m);
    eqWearArmor();
  }
  if (dungeon.hp <= 0) dungeonDeath();
  return rec;
}
function lockPounce(m: Monster) {
  const T = dungeon.tile,
    a = Math.atan2(dungeon.py - m.y, dungeon.px - m.x),
    d = Math.hypot(dungeon.px - m.x, dungeon.py - m.y),
    reach = Math.min(d + T * 0.4, T * (m.boss ? 3.6 : 3.0));
  m.locked = true;
  m.ang = a;
  m.l0 = reach;
  m.lx = Math.max(T, Math.min(dungeon.cols * T - T, m.x + Math.cos(a) * reach));
  m.ly = Math.max(T, Math.min(dungeon.rows * T - T, m.y + Math.sin(a) * reach));
}
export function updateDungeonMonster(this: unknown, m: Monster, dt: number) {
  /* v6.8 */
  if (m && m.alive && m.critter) {
    critAI(m, dt);
    return;
  }
  if (m && m.alive && m.neutral) {
    loboAI(m, dt);
    return;
  }
  /* v6.2 — ---------- tick e IA ---------- */
  if (!m.alive) return updateDungeonMonsterBase4.apply(this, arguments as Repasse);
  try {
    folTick(m, dt);
    stickTick(m, dt);
    if (!m.alive) return;
  } catch (e) {
    console.warn(e);
  }
  if (m.crav && !isMonstro(m)) {
    if (m.flash! > 0) m.flash! -= dt;
    return;
  } // cravado: não ataca, só puxa e se debate
  return updateDungeonMonsterBase4.apply(this, arguments as Repasse);
}
// etapa de updateDungeonMonster: v5.8 + v5.9.02 + v6.0
function updateDungeonMonsterBase4(m: Monster, dt: number) {
  if (m.humano && m.flash! > 0) m.flash = Math.max(0, m.flash! - dt);
  /* v6.0 — IA: laçado ou desmaiado não ataca */
  if (m.ko! > 0) {
    m.ko! -= dt;
    m.downT = Math.max(m.downT || 0, 0.1);
    m.st = "recover";
    m.t = 0.3;
    if (m.humano) {
      m.moving = false;
      m.humanoCorrendo = false;
      m.humanoRolando = false;
    }
    if (m.ko! <= 0) {
      m.ko = 0;
      if (!m.humano) spawnDungeonToast("Acordou!", m.x, m.y - 30, "#ffb37a", 12); // v8.1: no humano ele se levanta, sem texto
      applyStunRaw(m, 0.6);
      folWake(m);
    }
    return;
  }
  if (folFugindo(m, dt)) return;
  if (m.bound) {
    ropeTug(m, dt);
    return;
  }
  if (m.bandido) return bandidoAI(m, dt); // v8.1: a luta contra humanos refeita (field/bandidos.ts)
  if (m.humano) return humanoTactics(m, dt);
  /* v5.9.02 (antes) */
  const x0 = m.x,
    y0 = m.y;
  const r = updateDungeonMonsterBase3(m, dt);
  /* v8.0 — no campo aberto o javali não entra na água nem atravessa tronco; na investida, bater nisso = bater na parede.
     v8.1: só a trombada de frente conta (raspar de lado escorrega e segue) e cansa; passeando ou rodeando, quando o tronco
     barra ele escolhe outro rumo em vez de ficar empurrando a árvore */
  if (m.kind === "javalino" && dungeon.origem) {
    const x1 = m.x,
      y1 = m.y,
      st = m.st;
    [m.x, m.y] = mundoMover(x0, y0, x1, y1, 0.3);
    if (m.x !== x1 || m.y !== y1) {
      const qx = x1 - x0,
        qy = y1 - y0,
        q = Math.hypot(qx, qy) || 1,
        frente = ((m.x - x0) * qx + (m.y - y0) * qy) / (q * q); // quanto do passo andou na direção pretendida
      if (st === "charge" && frente < BOAR_ARVORE.frente) boarTrombou(m);
      else if (st === "wander") m.target = null;
      else if (st === "chase" && frente < 0.3) m.rodeio = -(m.rodeio || 1);
    }
  }
  /* v5.9.02 (depois) */
  if (m.cripple! > 0) {
    m.cripple! -= dt;
    m.x = x0 + (m.x - x0) * 0.35;
    m.y = y0 + (m.y - y0) * 0.35;
  }
  /* v7.7 — cansado anda mais devagar (4 faixas de fôlego: folVel) */
  const kv = folVel(m);
  if (kv < 1) {
    m.x = x0 + (m.x - x0) * kv;
    m.y = y0 + (m.y - y0) * kv;
  }
  return r;
}
/** Sparring simples: aproximação, golpe telegrafado e recuperação curta. */
function humanoTactics(m: Monster, dt: number) {
  const d = dungeon,
    T = d.tile,
    dx = d.px - m.x,
    dy = d.py - m.y,
    dist = Math.hypot(dx, dy) || 1,
    a = Math.atan2(dy, dx),
    h = d.hero ? ensureHero(d.hero) : null,
    bow = m.humanoArma === "bow",
    profile = h ? wpnProf(h) : null,
    alcance = bow ? T * (WEAPONS.bow.range || 6.5) : T * (profile?.reach || 0.95);
  m.moving = false;
  m.humanoCorrendo = false;
  m.humanoFolego = Math.min(100, (m.humanoFolego ?? 100) + (m.st === "recover" ? 18 : 9) * dt);
  m.humanoEsquivaCd = Math.max(0, (m.humanoEsquivaCd || 0) - dt);
  m.humanoInvuln = Math.max(0, (m.humanoInvuln || 0) - dt);
  m.humanoGuardT = Math.max(0, (m.humanoGuardT || 0) - dt);
  m.humanoTrocaCd = Math.max(0, (m.humanoTrocaCd || 0) - dt);
  if (m.humanoTrocaT != null) {
    m.humanoTrocaT = Math.max(0, m.humanoTrocaT - dt);
    if (m.humanoTrocaT <= 0) m.humanoTrocaT = undefined;
  }
  m.stun = Math.max(0, (m.stun || 0) - dt);
  m.slow = Math.max(0, (m.slow || 0) - dt);
  if (m.humanoGolpeT != null) {
    m.humanoGolpeT += dt;
    if (m.humanoGolpeT > 0.38) m.humanoGolpeT = undefined;
  }
  if (m.humanoSoltarT != null) {
    m.humanoSoltarT = Math.max(0, m.humanoSoltarT - dt);
    if (m.humanoSoltarT <= 0) m.humanoSoltarT = undefined;
  }
  if (m.humanoAtingidoT != null) {
    m.humanoAtingidoT += dt;
    if (m.humanoAtingidoT >= 0.45) m.humanoAtingidoT = undefined;
  }
  if (m.humanoBloqueouT != null) {
    m.humanoBloqueouT += dt;
    if (m.humanoBloqueouT >= 0.5) m.humanoBloqueouT = undefined;
  }
  if (m.st !== "windup") m.ang = a;
  if ((m.stun || 0) > 0) {
    m.st = "recover";
    m.t = Math.max(m.t || 0, m.stun || 0);
    return;
  }
  if ((m.humanoEsquivaT || 0) > 0) {
    m.humanoEsquivaT = Math.max(0, m.humanoEsquivaT! - dt);
    if (m.humanoEsquivaT <= 0) m.humanoRolando = false;
    m.moving = true;
    const speed = velocidadeParceiro(false) * 1.25 * dt * folVel(m);
    const x0 = m.x,
      y0 = m.y,
      x1 = Math.max(T, Math.min(d.cols * T - T, x0 + (m.humanoEsquivaX || 0) * speed)),
      y1 = Math.max(T, Math.min(d.rows * T - T, y0 + (m.humanoEsquivaY || 0) * speed));
    [m.x, m.y] = mundoMover(x0, y0, x1, y1);
    m.moving = Math.hypot(m.x - x0, m.y - y0) > 0.05;
    return;
  }
  if ((m.humanoGuardT || 0) > 0) {
    m.st = "recover";
    m.t = 0.1;
    return;
  }
  if (m.st === "windup") {
    m.t -= dt;
    if (m.t <= 0) {
      const da = Math.abs(Math.atan2(Math.sin(a - (m.ang ?? a)), Math.cos(a - (m.ang ?? a))));
      const pesado = m.atk === "heavy" || m.atk === "heavy_arrow",
        flecha = m.atk === "arrow" || m.atk === "heavy_arrow",
        alcanceGolpe = flecha ? alcance : alcance * (pesado ? 1.12 : 0.92);
      if (dist <= alcanceGolpe && da < (flecha ? 1.2 : pesado ? 0.9 : 0.75) && !d.dead) {
        const forca = !h
          ? 4
          : flecha
            ? bowBaseDmg(h, h.skills.arco?.level || 0) * eqBowMult(h) * (pesado ? 1.5 : 0.95)
            : meleeDmg(h) * (profile?.mult || 1) * (pesado ? 3.5 : 2.4);
        wolfStrike(m, null, forca, 0.6);
      } else spawnDungeonToast("Esquivou do golpe", d.px, d.py - 28, "#9fe3ff", 11);
      m.st = "recover";
      m.t = pesado ? 0.9 : flecha ? 0.58 : 0.48;
      m.pcd = pesado ? 1.1 : flecha ? 0.78 : 0.55;
      if (flecha) {
        m.humanoGolpeT = undefined;
        m.humanoSoltarT = 0.5;
      }
      m.humanoLado = -(m.humanoLado || 1);
    }
    return;
  }
  if (m.st === "recover") {
    m.t -= dt;
    if (m.t <= 0) m.st = "chase";
    return;
  }
  m.pcd = Math.max(0, (m.pcd || 0) - dt);
  const folego = m.humanoFolego || 0,
    estilo = m.humanoPersonalidade || "calculista",
    ameaca = !!(d.hv || d.spCh || d.charging || d.slash),
    chanceEsquiva = estilo === "acrobata" ? 0.96 : estilo === "agressivo" ? 0.62 : 0.82;
  if (
    ameaca &&
    dist < (bow ? T * 6.5 : alcance + T * 0.6) &&
    (m.humanoEsquivaCd || 0) <= 0 &&
    folego >= 24 &&
    m.st !== "recover" &&
    Math.random() < chanceEsquiva * defesaFolego(m)
  ) {
    const chanceBloqueio = estilo === "calculista" ? 0.72 : estilo === "agressivo" ? 0.22 : 0.38;
    if (!bow && m.humanoEscudo && Math.random() < chanceBloqueio * defesaFolego(m)) {
      m.humanoFolego = folego - 16;
      m.humanoGuardT = 0.38;
      m.humanoBloqueouT = 0;
      if (m.st === "windup") {
        m.humanoGolpeT = undefined;
        m.pcd = Math.max(m.pcd || 0, 0.45);
      }
      m.st = "recover";
      m.t = 0.1;
      addRing(m.x, m.y, "#9fe3ff", 28, 0.3, 2.5);
      return;
    }
    const lado = m.humanoLado || 1,
      ux = (m.x - d.px) / dist,
      uy = (m.y - d.py) / dist,
      vx = ux * 0.35 - uy * lado * 0.94,
      vy = uy * 0.35 + ux * lado * 0.94,
      n = Math.hypot(vx, vy) || 1;
    m.humanoFolego = folego - 24;
    m.humanoEsquivaCd = 1.5;
    m.humanoEsquivaT = 0.24;
    m.humanoRolando = bow;
    m.humanoEsquivaX = vx / n;
    m.humanoEsquivaY = vy / n;
    m.humanoInvuln = 0.18;
    m.humanoLado = -lado;
    if (m.st === "windup") {
      m.humanoGolpeT = undefined;
      m.st = "recover";
      m.t = 0.24;
      m.pcd = Math.max(m.pcd || 0, 0.45);
    }
    return;
  }
  const trocaParaArco =
      !bow && dist > T * (estilo === "agressivo" ? 5.2 : estilo === "acrobata" ? 3.4 : 3.8) && folego > 30,
    trocaParaMelee = bow && (dist < T * 2.5 || folego < 18);
  if ((trocaParaArco || trocaParaMelee) && (m.humanoTrocaCd || 0) <= 0) {
    m.humanoArma = trocaParaArco ? "bow" : "melee";
    m.humanoFolego = Math.max(0, folego - 5);
    m.humanoTrocaT = 0.28;
    m.humanoTrocaCd = 1.1;
    m.humanoGolpeT = undefined;
    m.st = "recover";
    m.t = 0.28;
    m.pcd = Math.max(m.pcd || 0, 0.35);
    addRing(m.x, m.y, trocaParaArco ? "#9fe3ff" : "#ffc66b", 30, 0.3, 2.5);
    return;
  }
  const precisaRecuar = folego < 18 && dist < T * (bow ? 3 : 1.6);
  if (!precisaRecuar && dist <= (bow ? alcance * 0.82 : alcance * 0.92) && m.pcd <= 0) {
    const seq = m.humanoAtaques || 0,
      pesado = (estilo === "agressivo" ? seq % 2 === 1 : seq % 3 === 2) && folego >= 38;
    m.humanoAtaques = seq + 1;
    m.humanoPassoGolpe = seq % 3;
    m.humanoGolpeT = 0;
    m.st = "windup";
    m.atk = bow ? (pesado ? "heavy_arrow" : "arrow") : pesado ? "heavy" : "jab";
    const custo = pesado ? 28 : bow ? 18 : 12;
    if (folego < custo) {
      m.st = "recover";
      m.t = 0.55;
      return;
    }
    m.humanoFolego = folego - custo;
    // O impacto acompanha o pico dos mesmos clips de espada usados pelo jogador.
    m.t = m.wuTot = bow ? 0.34 : pesado ? 0.2 : 0.16;
    m.ang = a;
    addRing(
      m.x,
      m.y,
      pesado ? "#ff6868" : bow ? "#9fe3ff" : "#ffb36b",
      pesado ? 38 : 26,
      pesado ? 0.42 : 0.3,
      pesado ? 3.5 : 2.5,
    );
    return;
  }
  m.st = "chase";
  m.moving = dist > T * 0.72 || (bow && dist < T * 2.4) || precisaRecuar;
  if (!m.moving) return;
  const lado = m.humanoLado || 1,
    lateral = dist < T * 2.8 ? (estilo === "acrobata" ? 0.78 : estilo === "agressivo" ? 0.16 : 0.42) * lado : 0,
    recuar = precisaRecuar || (bow && dist < T * 2.4),
    aproximacao = recuar ? -1 : dist < alcance * 0.8 ? 0 : 1,
    vx = (dx / dist) * aproximacao - (dy / dist) * lateral,
    vy = (dy / dist) * aproximacao + (dx / dist) * lateral,
    norm = Math.hypot(vx, vy) || 1,
    correr = !recuar && dist > T * 2.6 && folego > (estilo === "agressivo" ? 22 : 30),
    speed = velocidadeParceiro(correr) * dt * (m.slow! > 0 ? 0.48 : 1) * folVel(m);
  m.humanoCorrendo = correr;
  if (correr) m.humanoFolego = Math.max(0, folego - 16 * dt);
  const x0 = m.x,
    y0 = m.y,
    x1 = Math.max(T, Math.min(d.cols * T - T, x0 + (vx / norm) * speed)),
    y1 = Math.max(T, Math.min(d.rows * T - T, y0 + (vy / norm) * speed));
  [m.x, m.y] = mundoMover(x0, y0, x1, y1);
  m.moving = Math.hypot(m.x - x0, m.y - y0) > 0.05;
}
/** Movimento do sparring acompanha os atributos e o ritmo atual de deslocamento da personagem. */
function velocidadeParceiro(correr: boolean) {
  const d = dungeon,
    h = d.hero ? ensureHero(d.hero) : null;
  if (!h) return 34;
  return (26 + attrOf(h, "velocidade") * STAT.velMove) * survMoveMult() * (correr ? 1.7 : 1);
}
function updateDungeonMonsterBase3(m: Monster, dt: number) {
  if (m.kind !== "javalino" || m.dummy) return updateDungeonMonsterBase2(m, dt);
  boarAI(m, dt);
}
// etapa de updateDungeonMonster: v5.0
function updateDungeonMonsterBase2(m: Monster, dt: number) {
  /* v5.0 */
  if (!m.dummy) return updateDungeonMonsterBase(m, dt);
  m.st = "dummy";
  m.stun = 0;
  m.kx = 0;
  m.ky = 0;
  m.retreat = 0;
  m.slow = 0;
  m.alive = true;
  if (m.wob! > 0) m.wob = Math.max(0, m.wob! - dt * 2.4);
  if (m.flash! > 0) m.flash! -= dt;
  if (m.bleed) {
    m.bleed.t -= dt;
    if (m.bleed.t <= 0) bleedTick(m);
  }
}
// etapa de updateDungeonMonster: original
function updateDungeonMonsterBase(m: Monster, dt: number) {
  if (!m.alive) return;
  if (m.flash! > 0) m.flash! -= dt;
  if (m.kx || m.ky) {
    // knockback com deslize (desacelera rápido)
    const T0 = dungeon.tile;
    m.x = Math.max(T0, Math.min(dungeon.cols * T0 - T0, m.x + m.kx! * dt));
    m.y = Math.max(T0, Math.min(dungeon.rows * T0 - T0, m.y + m.ky! * dt));
    const f = Math.exp(-9 * dt);
    m.kx! *= f;
    m.ky! *= f;
    if (Math.abs(m.kx!) + Math.abs(m.ky!) < 4) m.kx = m.ky = 0;
  }
  if (m.slow! > 0) {
    m.slow! -= dt;
    if (m.slow! <= 0) m.slowShown = 0;
  }
  if (m.stun! > 0) m.stun! -= dt;
  if (m.bleed) {
    m.bleed.t -= dt;
    if (m.bleed.t <= 0) bleedTick(m);
    if (!m.alive) return;
  }
  if (!m.lowSet && m.hp < m.hpMax * (m.boss ? 0.25 : 0.32)) {
    // vida baixa: cada lobo reage de um jeito
    m.lowSet = true;
    m.low = m.boss ? "frenzy" : Math.random() < 0.5 ? "flee" : "frenzy";
    if (m.low === "flee") {
      m.fleeT = 3.2 + Math.random() * 2;
      spawnDungeonToast("Lobo fugindo!", m.x, m.y - 34, "#9fe3ff", 12);
    } else spawnDungeonToast(m.boss ? "O Alfa enlouqueceu!" : "Lobo desesperado!", m.x, m.y - 34, "#ff9a6a", 12);
  }
  const T = dungeon.tile,
    d = Math.hypot(dungeon.px - m.x, dungeon.py - m.y),
    safe = dSafe();
  if (m.boss && !m.howled && m.hp < m.hpMax * 0.5) {
    m.howled = true;
    setBanner("🐺 O Alfa uivou!", "Lobos de reforço chegaram", 3, "#ff9a9a");
    spawnDungeonMonster();
    spawnDungeonMonster();
    shakeScreen(0.3, 5);
  }
  m.t -= dt * (m.slow! > 0 && m.st === "windup" ? 0.6 : 1);
  if (m.pcd! > 0) m.pcd! -= dt;
  if (m.hitT! > 0) m.hitT! -= dt;
  if (m.st === "windup") {
    // telegrafa o golpe: dá tempo de sair do círculo
    if (m.atk === "pounce" && !m.locked && m.t <= POUNCE_LOCK) lockPounce(m);
    if (m.t <= 0) {
      const pr = m.parry;
      m.parry = null;
      if (m.atk === "pounce") {
        // BOTE: o lobo salta na direção/ponto travados
        if (!m.locked) lockPounce(m);
        m.st = "leap";
        m.lt = 0;
        m.hit = false;
        m.lpr = pr;
        m.pcd = (m.boss ? 3 : m.kind === "javalino" ? 1.6 : 4.5) + Math.random() * 2;
        addRing(m.x, m.y, "#ffb37a", 26, 0.25, 3);
        sfx("shoot");
        return;
      }
      // MORDIDA: ataque básico, rápido e curto (cone ~100°)
      let rec = m.boss ? 0.5 : 0.45;
      const BR = T * (m.boss ? 1.25 : 0.95),
        _toP = Math.atan2(dungeon.py - m.y, dungeon.px - m.x),
        _da = Math.abs(Math.atan2(Math.sin(_toP - (m.ang || 0)), Math.cos(_toP - (m.ang || 0))));
      if (!safe && d < BR && (_da <= 0.7 || d < T * 0.35)) rec = wolfStrike(m, pr, 2.2 + Math.random() * 2.2, rec);
      else spawnDungeonToast(safe ? "Zona segura!" : "Esquivou!", dungeon.px, dungeon.py - 16, "#9fe3ff");
      m.st = "recover";
      m.t = rec * (m.low === "frenzy" ? 0.55 : 1);
    }
    return;
  }
  if (m.st === "leap") {
    // em pleno ar: o lobo realmente se move até o ponto de pouso
    const dx = m.lx! - m.x,
      dy = m.ly! - m.y,
      dist = Math.hypot(dx, dy),
      stp = Math.min((m.boss ? 360 : m.kind === "javalino" ? 380 : 300) * dt, dist);
    if (dist > 0.5) {
      m.x += (dx / dist) * stp;
      m.y += (dy / dist) * stp;
    }
    m.lt! += dt;
    m.lp = Math.min(1, 1 - Math.max(0, dist - stp) / (m.l0 || 1));
    if (!m.hit && !safe && !dungeon.dead && Math.hypot(dungeon.px - m.x, dungeon.py - m.y) < T * 0.85) {
      m.hit = true;
      m.recO = wolfStrike(m, m.lpr, 3 + Math.random() * 4, m.boss ? 1.3 : 1.2);
    }
    if (dist - stp <= 0.5 || m.lt! > 0.9) {
      m.st = "recover";
      m.t = m.recO || (m.boss ? 1.3 : 1.2);
      m.recO = 0;
      m.lp = 0;
      addRing(m.x, m.y, "#c9a27a", 32, 0.3, 3);
      shakeScreen(0.1, 2);
      if (!m.hit && !safe && Math.hypot(dungeon.px - m.x, dungeon.py - m.y) < T * 2.4)
        spawnDungeonToast("Esquivou o bote!", dungeon.px, dungeon.py - 16, "#9fe3ff");
    }
    return;
  }
  if (m.st === "recover") {
    if (m.t <= 0) {
      const ws = m.stunMax! > 0;
      m.st = "chase";
      m.stunMax = 0;
      m.retreat = ws ? 0 : 0.45 + Math.random() * 0.6;
      m.hop = ws ? 0 : 0.3;
      m.cmt = ((ws ? 0.4 : 0.8) + Math.random() * 1.4) * (m.low === "frenzy" ? 0.45 : 1);
    }
    return;
  }
  if (m.fleeT! > 0 && !safe) {
    // foge do jogador; se for acuado, vira uma mordida desesperada e depois entra em frenesi
    m.fleeT! -= dt;
    m.st = "chase";
    const ux = (dungeon.px - m.x) / (d || 1),
      uy = (dungeon.py - m.y) / (d || 1),
      spd = (m.spd || 38) * 1.75 * dt * (m.slow! > 0 ? 0.45 : 1),
      hiX = dungeon.cols * T - T,
      hiY = dungeon.rows * T - T;
    const nx = Math.max(T, Math.min(hiX, m.x - ux * spd)),
      ny = Math.max(T, Math.min(hiY, m.y - uy * spd)),
      stuck = Math.hypot(nx - m.x, ny - m.y) < spd * 0.45;
    m.x = nx;
    m.y = ny;
    if (m.fleeT! <= 0) m.low = "frenzy";
    if (d < T * 0.85 || (stuck && d < T * 2.4)) {
      m.fleeT = 0;
      m.low = "frenzy";
      m.st = "windup";
      m.atk = "bite";
      m.wuTot = m.t = 0.3;
      m.parry = null;
      m.ang = Math.atan2(dungeon.py - m.y, dungeon.px - m.x);
      spawnDungeonToast("Acuado!", m.x, m.y - 34, "#ff9a6a", 12);
    }
    return;
  }
  if (safe) m.alerted = false;
  if (!safe && (d < T * (m.boss ? 14 : 9) || m.alerted)) {
    if (!m.alerted) {
      m.alerted = true;
      if (m.cmt != null) m.cmt = Math.min(m.cmt, 0.6 + Math.random() * 0.8);
      for (const o of dungeon.monsters)
        if (o !== m && o.alive && !o.alerted && Math.hypot(o.x - m.x, o.y - m.y) < T * 8) o.alerted = true;
    }
    wolfTactics(m, dt, d, T);
    return;
  }
  m.st = "wander";
  const b = { x0: T, y0: T, x1: dungeon.cols * T - T, y1: dungeon.rows * T - T };
  if (!m.target || Math.hypot(m.target.x - m.x, m.target.y - m.y) < 4 || Math.random() < 0.01)
    m.target = { x: b.x0 + Math.random() * (b.x1 - b.x0), y: b.y0 + Math.random() * (b.y1 - b.y0) };
  const dx = m.target.x - m.x,
    dy = m.target.y - m.y,
    dist = Math.hypot(dx, dy) || 1,
    step = Math.min(20 * dt, dist);
  m.x += (dx / dist) * step;
  m.y += (dy / dist) * step;
}
export function updateFocusHud() {
  const el = document.getElementById("focus-hud")!,
    m = dungeon.target;
  if (!m || !m.alive) {
    el.style.display = "none";
    return;
  }
  el.style.display = "block";
  el.style.top = topoCanto(["dungeon-hud", "missao"]) + "px"; // v7.7: abaixo da barra do HUD e do objetivo
  const pct = Math.max(0, m.hp / m.hpMax),
    dying = pct < 0.3,
    d = Math.hypot(m.x - dungeon.px, m.y - dungeon.py) / dungeon.tile;
  el.className =
    (m.humano ? "human " : "") +
    (m.st === "windup" ? "danger " : "") +
    (dying ? "dying " : "") +
    (m.humano && m.ko! > 0 ? "vulnerable" : "");
  document.getElementById("fh-name")!.textContent = (m.humano ? "🤺 " : "🎯 ") + m.name;
  document.getElementById("fh-hpt")!.textContent =
    Math.max(0, Math.round(m.hp)) + " / " + m.hpMax + (dying ? " · quase morto!" : "");
  (el.querySelector("#fh-hp i") as HTMLElement).style.width = pct * 100 + "%";
  const folegoIA = Math.max(0, Math.min(100, m.humanoFolego || 0));
  (el.querySelector("#fh-stamina i") as HTMLElement).style.width = folegoIA + "%";
  document.getElementById("fh-stamt")!.textContent = Math.round(folegoIA) + "%";
  const L: Record<string, string> = {
    wander: "Patrulhando",
    chase: "Perseguindo você",
    windup: "⚠ PREPARANDO GOLPE!",
    leap: "🐺 BOTE!",
    recover: "Exposto — contra-ataque x1,7!",
  };
  if (m.st === "windup")
    L.windup = m.humano
      ? m.atk === "heavy" || m.atk === "heavy_arrow"
        ? "⚠ golpe pesado · esquive!"
        : m.atk === "arrow"
          ? "⚠ mirando o arco · esquive!"
          : "⚠ ataque rápido · esquive!"
      : m.atk === "pounce"
        ? "⚠ carregando um salto…"
        : "⚠ vai morder!";
  document.getElementById("fh-state")!.textContent =
    m.bandido && m.ko! > 0
      ? "Caído — E finaliza · R poupa"
      : m.bandido && m.bFoge
        ? "Fugindo"
        : m.bandido && m.bAteMorte
          ? "Até a morte!"
          : m.humano && m.ko! > 0
            ? "Vulnerável — E para finalizar"
            : m.humano && (m.humanoTrocaT || 0) > 0
              ? "Trocando de arma"
              : m.humano && m.humanoRolando
                ? "Rolando"
                : m.humano && (m.humanoEsquivaT || 0) > 0
                  ? "Passo evasivo"
                  : m.humano && (m.humanoGuardT || 0) > 0
                    ? "Defendendo com escudo"
                    : m.humano && folegoIA < 18 && m.st !== "windup"
                      ? "Recuperando o próprio fôlego"
                      : m.kind === "bird"
                        ? "Neutro — marcado: acerto garantido"
                        : L[m.st] || m.st;
  (el.querySelector("#fh-atk i") as HTMLElement).style.width =
    (m.st === "windup" ? (1 - m.t / (m.wuTot || 0.75)) * 100 : m.st === "recover" ? 100 : 0) + "%";
  document.getElementById("fh-extra")!.textContent =
    "Distância: " +
    d.toFixed(1) +
    " tiles" +
    (m.bandido
      ? ""
      : m.humano
        ? " · " + (m.humanoArma === "bow" ? "Arco" : "Espada") + " · " + (m.humanoPersonalidade || "calculista")
        : "") +
    (m.bleed ? " · 🩸 sangrando" : "") +
    // v7.7: o alvo prioritário mostra o fôlego do bicho (quando ele tem fôlego)
    (m.folMax ? " · Fôlego " + Math.round((Math.max(0, m.fol || 0) / m.folMax) * 100) + "%" : "");
}
export function bowRange(ch: number) {
  return dungeon.tile * (1.4 + 7.1 * ch);
} // 1,4 tiles sem carga -> 8,5 tiles na carga máxima
export function startCharge() {
  /* v5.8 */
  if (dungeon.down! > 0) return;
  // v8.1: botão direito no meio da puxada do básico: ela vira o tiro carregado (mira no mouse), com a carga que já tem
  if (puxandoBasico()) {
    largarBasico(false);
    dungeon.alvoAutomatico = null;
    return;
  }
  if (!dungeon.active || dungeon.weapon !== "bow" || dungeon.charging || dungeon.cd! > 0) return;
  refillQuiver();
  if (!econ.test && econ.quiver.n <= 0) {
    spawnDungeonToast("Sem flechas! Compre na Armaria ou faça (C)", dungeon.px, dungeon.py - 26, "#ff9a9a");
    return;
  }
  dungeon.charging = true;
  dungeon.tiroAuto = false;
  dungeon.charge = 0;
  dungeon.full = 0;
  dungeon.pinged = false;
  sfx("draw");
  bowQuickCheck();
}
export function fireArrow() {
  /* v6.5 */
  const was = dungeon.charging;
  fireArrowBase();
  /* v6.5 */
  try {
    if (was && ISC.on) ISC.shots = (ISC.shots || 0) + 1;
  } catch (_) {}
}
function fireArrowBase() {
  if (!dungeon.charging || dungeon.tiroAuto) return; // v8.1: a puxada do básico solta sozinha (updateCharge)
  const ch = dungeon.charge!,
    h = dungeon.hero!,
    ang = aimAngle(),
    arcoLv = (h.skills.arco && h.skills.arco.level) || 0;
  dungeon.charging = false;
  dungeon.charge = 0;
  dungeon.shotT = performance.now();
  dungeon.cd = 0.5;
  dungeon.cdMax = 0.5;
  sfx("shoot");
  reveal();
  eqWear("costas", 1);
  if (!econ.test) econ.quiver.n = Math.max(0, econ.quiver.n - 1);
  const dmg = bowBaseDmg(h, arcoLv) * (0.45 + 1.05 * ch) * eqBowMult(h),
    spd = 420;
  dungeon.arrows!.push({
    x: dungeon.px,
    y: dungeon.py,
    vx: Math.cos(ang) * spd,
    vy: Math.sin(ang) * spd,
    life: bowRange(ch) / spd,
    dmg,
    hits: new Set(),
    full: ch >= 1,
  });
  if (ch < 0.25) spawnDungeonToast("Carga fraca", dungeon.px, dungeon.py - 26, "#c9b88a");
}
/* ---- v8.1: básico do arco = puxar a corda (ARCO_BASICO.puxada s) mirando no alvo, com o percurso no chão, e soltar ---- */
/** A corda está puxada para o básico do arco: mira no alvo automático e solta sozinha. */
function puxandoBasico() {
  return !!(dungeon.charging && dungeon.tiroAuto);
}
/** Deixa de ser a puxada do básico e corta o som da corda: `abaixar` = abaixa o arco sem atirar (a flecha fica na
    aljava); senão ela continua puxada como o tiro carregado (o botão direito assumiu). */
function largarBasico(abaixar: boolean) {
  const d = dungeon;
  d.tiroAuto = false;
  if (d._pararPuxada) d._pararPuxada();
  d._pararPuxada = null;
  if (abaixar) {
    d.charging = false;
    d.charge = 0;
    d.full = 0;
  }
}
/** Básico do arco no alvo (ataque automático): começa a puxar a corda; updateCharge solta a flecha no corpo dele quando
    a corda enche. false = não começou. */
export function puxarBasico(alvo: Monster) {
  const d = dungeon;
  if (!d.active || d.weapon !== "bow" || d.charging || d.cd! > 0 || d.down! > 0) return false;
  refillQuiver();
  if (!econ.test && econ.quiver.n <= 0) {
    spawnDungeonToast("Sem flechas! Compre na Armaria ou faça (C)", d.px, d.py - 26, "#ff9a9a");
    d.alvoAutomatico = null;
    return false;
  }
  d.alvoAutomatico = alvo; // a mira e a soltura seguem o alvo automático (aimAngle, puxadaBasico)
  d.charging = true;
  d.tiroAuto = true;
  d.charge = 0;
  d.full = 0;
  d.pinged = true; // a corda cheia já é o tiro: sem o "ping" do carregado
  if (d._pararPuxada) d._pararPuxada();
  d._pararPuxada = somPuxarCorda(ARCO_BASICO.puxada);
  return true;
}
/** Um quadro da puxada do básico: enche a corda (andando demora mais, como no carregado; Força acelera) e, cheia, solta
    se o alvo está ao alcance — senão segura a corda, sem gastar fôlego, até ele voltar. Sem alvo, abaixa o arco. */
function puxadaBasico(dt: number, andando: boolean) {
  const d = dungeon,
    alvo = d.alvoAutomatico,
    B = ARCO_BASICO;
  if (
    !OPT.ataqueAutomatico ||
    d.weapon !== "bow" ||
    d.dead ||
    d.down! > 0 ||
    !alvo?.alive ||
    !d.monsters.includes(alvo)
  ) {
    largarBasico(true);
    return;
  }
  const rapidez = 1 + Math.max(0, attrOf(HERO()!, "forca") - 5) * STAT.forDraw;
  d.charge = Math.min(1, d.charge! + (dt * rapidez) / (B.puxada * (andando ? 1.8 / 1.1 : 1)));
  if (d.charge < 1) return;
  const corpo = wolfBody(alvo),
    q = bodyDist(corpo, d.px, d.py);
  if (q.d - corpo.r > d.tile * B.alcance) return;
  if (!econ.test && econ.quiver.n <= 0) {
    largarBasico(true);
    d.alvoAutomatico = null;
    spawnDungeonToast("Sem flechas! Compre na Armaria ou faça (C)", d.px, d.py - 26, "#ff9a9a");
    return;
  }
  const h = d.hero!,
    arcoLv = (h.skills.arco && h.skills.arco.level) || 0,
    ang = Math.atan2(q.y - d.py, q.x - d.px);
  largarBasico(true);
  d.shotT = performance.now();
  d.cd = B.pausa;
  d.cdMax = B.pausa;
  sfx("shoot");
  reveal();
  eqWear("costas", 1);
  if (!econ.test) econ.quiver.n = Math.max(0, econ.quiver.n - 1);
  d.arrows!.push({
    x: d.px,
    y: d.py,
    vx: Math.cos(ang) * B.velocidade,
    vy: Math.sin(ang) * B.velocidade,
    life: (d.tile * (B.alcance + 0.5)) / B.velocidade,
    dmg: bowBaseDmg(h, arcoLv) * B.dano * eqBowMult(h),
    hits: new Set(),
    full: false,
  });
}
export function updateCharge(dt: number) {
  if (!dungeon.charging) {
    // outra coisa abaixou o arco (dano, menu, troca de arma…) no meio da puxada do básico: corta o som da corda
    if (dungeon.tiroAuto || dungeon._pararPuxada) largarBasico(true);
    return;
  }
  const _k = dungeon.keys || {},
    _mv =
      _k.KeyW ||
      _k.KeyA ||
      _k.KeyS ||
      _k.KeyD ||
      dungeon.moveTarget ||
      (dungeon.joy && (dungeon.joy.x || dungeon.joy.y));
  if (dungeon.tiroAuto) {
    puxadaBasico(dt, !!_mv);
    return;
  }
  dungeon.charge = Math.min(
    1,
    dungeon.charge! + (dt * (1 + Math.max(0, attrOf(HERO()!, "forca") - 5) * STAT.forDraw)) / (_mv ? 1.8 : 1.1),
  ); // parado 1,1 s · andando 1,8 s
  if (dungeon.charge < 1) {
    consumirFolegoExterno(dungeon, (ARCO_FOL.gasto / ARCO_FOL.passo) * dt, 0.3);
  }
  if (dungeon.charge >= 1 && !dungeon.pinged) {
    dungeon.pinged = true;
    sfx("ping");
  }
  if (dungeon.charge >= 1) {
    // A puxada e a tensão usam a externa; sem fôlego externo, mantém a perda de mira existente.
    const d = dungeon,
      F = ARCO_FOL;
    d.full! += dt;
    d.gregen = Math.max(d.gregen || 0, 0.3); // segurando, o fôlego não volta
    while (d.full! >= F.passo && d.charging) {
      d.full! -= F.passo;
      if ((d.gstam ?? 100) <= 0) {
        d.charging = false;
        d.charge = 0;
        d.cd = 0.6;
        spawnDungeonToast("O braço cansou: perdeu a mira", d.px, d.py - 26, "#c9b88a");
      } else {
        consumirFolegoExterno(d, F.gasto, 0.3);
      }
    }
  }
}
/** v8.0 — clique esquerdo com o arco puxado: abaixa o arco sem atirar (a flecha volta para a aljava). */
export function cancelarTiro() {
  const d = dungeon;
  // v8.1: na puxada do básico o clique segue adiante: noutro bicho troca o alvo, no chão para (puxadaBasico abaixa)
  if (!d.charging || d.tiroAuto) return false;
  d.charging = false;
  d.charge = 0;
  d.full = 0;
  d.cd = 0.15;
  spawnDungeonToast("Tiro cancelado", d.px, d.py - 26, "#c9b88a", 11);
  return true;
}
/** v8.1 — o percurso da flecha do básico, no chão: tracejado até onde ela vai acertar o alvo (vermelho e até o fim do
    alcance se ele está longe), com a parte já puxada da corda cheia por cima e a ponta no fim. */
function drawAimBasico() {
  const d = dungeon,
    c = TELAS.dCtx,
    alvo = d.alvoAutomatico,
    ch = d.charge || 0,
    ang = aimAngle(),
    ini = 10;
  let len = d.tile * ARCO_BASICO.alcance,
    alcanca = false;
  if (alvo?.alive) {
    const corpo = wolfBody(alvo),
      q = bodyDist(corpo, d.px, d.py);
    alcanca = q.d - corpo.r <= len;
    if (alcanca) len = Math.max(ini + 6, Math.hypot(q.x - d.px, q.y - d.py));
  }
  const cor = alcanca ? "255,224,138" : "255,130,110";
  c.save();
  c.translate(d.px, d.py);
  c.rotate(ang);
  c.lineCap = "round";
  c.setLineDash([5, 6]);
  c.lineWidth = 1.5;
  c.strokeStyle = "rgba(" + cor + ",.5)";
  c.beginPath();
  c.moveTo(ini, 0);
  c.lineTo(len, 0);
  c.stroke();
  c.setLineDash([]);
  c.lineWidth = 3;
  c.strokeStyle = "rgba(" + cor + "," + (0.55 + 0.4 * ch) + ")";
  c.beginPath();
  c.moveTo(ini, 0);
  c.lineTo(ini + (len - ini) * ch, 0);
  c.stroke();
  c.fillStyle = "rgba(" + cor + "," + (0.5 + 0.5 * ch) + ")";
  c.beginPath();
  c.moveTo(len + 7, 0);
  c.lineTo(len - 4, -5);
  c.lineTo(len - 4, 5);
  c.closePath();
  c.fill();
  c.restore();
  c.fillStyle = "rgba(0,0,0,.55)";
  c.fillRect(d.px - 16, d.py + 24, 32, 4);
  c.fillStyle = ch >= 1 ? "#ffe08a" : "#9fe3ff";
  c.fillRect(d.px - 16, d.py + 24, 32 * ch, 4);
}
export function drawAim() {
  if (!dungeon.charging) return;
  if (dungeon.tiroAuto) return drawAimBasico();
  const c = TELAS.dCtx,
    ch = dungeon.charge!,
    len = bowRange(ch),
    ang = aimAngle(),
    full = ch >= 1;
  c.save();
  c.translate(dungeon.px, dungeon.py);
  c.rotate(ang);
  c.fillStyle = full ? "rgba(255,224,138,0.28)" : "rgba(255,255,255," + (0.07 + 0.12 * ch) + ")";
  c.fillRect(0, -5, len, 10);
  c.strokeStyle = full ? "#ffe08a" : "rgba(255,255,255,.5)";
  c.lineWidth = 1.5;
  c.strokeRect(0, -5, len, 10);
  c.beginPath();
  c.moveTo(len, -9);
  c.lineTo(len + 10, 0);
  c.lineTo(len, 9);
  c.stroke();
  c.restore();
  c.fillStyle = "rgba(0,0,0,.55)";
  c.fillRect(dungeon.px - 16, dungeon.py + 24, 32, 4);
  c.fillStyle = full ? "#ffe08a" : "#9fe3ff";
  c.fillRect(dungeon.px - 16, dungeon.py + 24, 32 * ch, 4);
}
export function drawMeleeBar() {
  // melee: barrinha enche na recuperação do golpe/parry; a fininha mostra a janela do combo
  const d = dungeon,
    c = TELAS.dCtx;
  if (d.weapon !== "melee" || d.dead || d.charging) return;
  const bars: [number, string, number][] = [];
  if (d.cd! > 0 && d.cdMax)
    bars.push([1 - d.cd! / Math.max(d.cdMax, d.cd!), d.lastStep === 2 ? "#ffb347" : "#ffe08a", 4]);
  if (d.parryCd! > 0 && d.parryMax) bars.push([1 - d.parryCd! / Math.max(d.parryMax, d.parryCd!), "#ffffff", 4]);
  if (d.comboT! > 0 && d.combo! > 0) bars.push([d.comboT! / COMBO_WINDOW, "#9fe3ff", 2]);
  if (d.riposte! > 0) bars.push([Math.min(1, d.riposte! / 3), "#ffe08a", 3]);
  if (d.boost! > 0) bars.push([Math.min(1, d.boost! / 3), "#b8f08a", 2]);
  let y = d.py + 24;
  for (const [f, col, h] of bars) {
    c.fillStyle = "rgba(0,0,0,.55)";
    c.fillRect(d.px - 16, y, 32, h);
    c.fillStyle = col;
    c.fillRect(d.px - 16, y, 32 * Math.max(0, Math.min(1, f)), h);
    y += h + 2;
  }
}
export function drawArrows(dt: number) {
  const c = TELAS.dCtx;
  for (let i = dungeon.arrows!.length - 1; i >= 0; i--) {
    const a = dungeon.arrows![i],
      _x0 = a.x,
      _y0 = a.y;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.life -= dt;
    let _m = null;
    {
      const n = Math.max(1, Math.ceil(Math.hypot(a.x - _x0, a.y - _y0) / 5)),
        bodies = dungeon.monsters.filter((m) => m.alive).map((m) => [m, wolfBody(m)] as const);
      for (let k = 1; k <= n && !_m; k++) {
        const px = _x0 + ((a.x - _x0) * k) / n,
          py = _y0 + ((a.y - _y0) * k) / n;
        for (const [m, B] of bodies)
          if (bodyDist(B, px, py).d <= (D3.gl ? B.r + 4 : Math.max(14, B.r))) {
            _m = m;
            a.x = px;
            a.y = py;
            break;
          }
      }
    }
    if (_m) {
      dungeon.inShot = true;
      const mk = markMult(_m),
        ts = _m.slow! > 0 || _m.stun! > 0 ? nv(HERO()!, "tiro_certeiro", 1) : 1;
      addBowPts(1 + (a.full ? 2 : 0) + (mk > 1 ? 1 : 0)); // acerto +1 · carga máxima +2 · alvo marcado +1
      hurtMonster(_m, a.dmg * 0.56, "arco", 3); // impacto: 56% do dano (45 de 80)
      if (_m.alive) {
        arrowStick(_m, a, a.dmg * 0.44 * mk * ts); // mesmo dano total, mas em pulsos 1-2-1-2 por mais tempo
        if (a.full && Math.hypot(_m.x - dungeon.px, _m.y - dungeon.py) <= dungeon.tile * 3) {
          // carga máxima + alvo PERTO empurra
          const n = Math.hypot(a.vx, a.vy) || 1,
            kb = _m.boss ? 10 : 26; // desliza com a mesma física do empurrão da espada
          _m.kx = (_m.kx || 0) + (a.vx / n) * kb * 9;
          _m.ky = (_m.ky || 0) + (a.vy / n) * kb * 9;
          spawnDungeonToast("Empurrado!", _m.x, _m.y - 38, "#9fe3ff");
        }
      }
      dungeon.inShot = false;
      sfx("arrowhit");
      dungeon.arrows!.splice(i, 1);
      continue;
    } // não perfura: para no primeiro alvo
    let _gone = false; // pássaros
    for (const b of dungeon.birds!) {
      if (!b.alive || (a.seen && a.seen.has(b)) || Math.hypot(b.x - a.x, b.y - a.y) > 14) continue;
      (a.seen || (a.seen = new Set())).add(b);
      const marked = dungeon.target === b || dungeon.foco === b; // v7.7: o foco também conta como marcado
      if (marked || Math.random() < BIRD_LUCK) {
        killBird(b, marked);
        dungeon.arrows!.splice(i, 1);
        _gone = true;
        break;
      }
      spawnDungeonToast("Desviou!", b.x, b.y - 16, "#9fe3ff");
      sfx("miss");
    }
    if (_gone) continue;
    if (a.life <= 0) {
      sfx("miss");
      spawnDungeonToast("Errou", a.x, a.y, "#c9b88a");
      dungeon.arrows!.splice(i, 1);
      continue;
    }
    c.strokeStyle = a.full ? "#ffe08a" : "#f2e2b3";
    c.lineWidth = a.full ? 3 : 2;
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(a.x - a.vx * 0.05, a.y - a.vy * 0.05);
    c.stroke();
  }
}
