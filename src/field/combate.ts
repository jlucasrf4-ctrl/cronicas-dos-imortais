/* ==== Fase 4 — ganchos de combate: bloqueio, parry, lentidão, atordoar, sangrar, dano no jogador (base/03) ==== */
import { dungeon, GL3, econ, TELAS } from "../core/state.ts";
import { ensureHero } from "../hero/nivel.ts";
import { MOB } from "../ui/celular.ts";
import { mordidaCampanha } from "../campanha/lobos.ts";
import { aimAngle, hurtMonster } from "./acertos.ts";
import { synOn, nv, nodeRank } from "../hero/arvores.ts";
import { MARK_BONUS, KO_T, DANO } from "../data/combate.ts";
import { attrOf } from "../hero/atributos.ts";
import { ensureFol, plateMult } from "./dano.ts";
import { spawnDungeonToast } from "./masmorra.ts";
import { folOn, folDrain } from "./tipos.ts";
import { STAT } from "../data/atributos.ts";
import { PARRY_PERFECT, shakeScreen, sfx } from "./chao.ts";
import { HERB_TICK } from "../data/recursos.ts";
import { ISC, introObj } from "../intro/cena.ts";
import { ISC_BOAR } from "../data/intro.ts";
import { mountLv, mnt } from "../creatures/tamandua.ts";
import { SURV } from "../data/sobrevivencia.ts";
import { D3 } from "./projecao.ts";
import type { Monster } from "../core/tipos.ts";

/* ===== v3.8: ganchos de combate (bloqueio/parry/sangramento/IA/dano no jogador) ===== */
export function HERO() {
  return dungeon.hero ? ensureHero(dungeon.hero) : null;
}

/* ---------- personagem: encara o alvo marcado; durante mira, ataque ou defesa segue a ação ativa ---------- */
export function heroFaceAngle() {
  /* v6.9 — pose: o herói encara o bicho com a estocada congelada (a ponta fica no bicho) */
  {
    const C = dungeon.crav;
    if (C && C.m) return Math.atan2(C.m.y - dungeon.py, C.m.x - dungeon.px);
  }
  const d = dungeon;
  if (d.charging || d.spCh || d.hv || d.guard || d.crav || d.rope || (MOB.on && MOB.aim != null)) return aimAngle();
  // v7.7: correndo, olha para onde corre (correr de costas para o alvo era o moonwalk); andando, segue encarando o alvo
  if (d.running && GL3.mvA != null && (GL3.mvK || 0) > 0.5) return GL3.mvA;
  if (d.target && d.target.alive) return Math.atan2(d.target.y - d.py, d.target.x - d.px);
  return GL3.mvA != null ? GL3.mvA : aimAngle();
}

export function markMult(m: Monster) {
  const h = HERO();
  if (!h) return 1;
  // v7.7 — o alvo atual só conta como marcado com o nó Rastreador (antes valia sempre)
  const marked =
    (dungeon.target === m && nodeRank(h, "rastreador") > 0) ||
    (m.bleed && synOn(h, "sangue_marcado")) ||
    (m.stun! > 0 && synOn(h, "predador_paciente")) ||
    (m.slow! > 0 && synOn(h, "caca_lenta") && dungeon.inShot);
  return marked ? MARK_BONUS + Math.max(0, attrOf(h, "destreza") - 5) * 0.03 : 1;
}
export function applyStun(m: Monster, t: number) {
  m.st = "recover";
  m.t = t;
  m.stun = t;
  m.stunMax = t;
  m.parry = null;
  /* v6.0 — desmaio: atordoado com pouca vida → desmaia (Alfa só abaixo de 15%) */
  try {
    if (m && m.alive && !m.dummy && m.hp / m.hpMax < (m.boss ? 0.15 : 0.25) && !(m.ko! > 0)) {
      if (folOn(m)) {
        ensureFol(m);
        folDrain(m, m.fol! + 1);
      } else {
        m.ko = KO_T + (m.boss ? 0 : 0.8);
        m.downT = Math.max(m.downT || 0, m.ko);
        spawnDungeonToast("😵 Desmaiou!", m.x, m.y - 34, "#ffe08a", 15);
      }
    }
  } catch (_) {}
}
export function applyBleed(m: Monster, qtd?: number) {
  // reescrita na v6.2; v8.0: a quantidade vale de novo (proporcional ao golpe) e acumula até DANO.CORTE.pilhas cortes,
  // espalhada em DANO.CORTE.dur s (era sempre 5 de vida: forte no lobo, nada no Alfa). Sem quantidade, o valor antigo.
  if (!m || !m.alive) return;
  const C = DANO.CORTE,
    b = m.bleed,
    t = b ? b.t : 1,
    add = qtd && qtd > 0 ? qtd : C.dps * C.dur,
    n = Math.min(C.pilhas, (b ? b.n || 1 : 0) + 1),
    rem = Math.min((b ? b.rem : 0) + add, add * C.pilhas, m.hpMax * C.teto);
  m.bleed = { rem, u: Math.max(0.2, rem / C.dur), i: 0, t, n };
}

export function applySlow(m: Monster, t: number) {
  m.slow = Math.max(m.slow || 0, t);
  m.slowMax = Math.max(m.slowMax || 0, t);
  m.slowShown = 1;
}
export function bleedTick(m: Monster) {
  // reescrita na v6.2
  const b = m.bleed;
  if (!b) return;
  // v8.0: pulsos de pelo menos 1 (abaixo de 1/s, 1 de dano a cada 1/u s: antes aparecia "-0") (mantenedor, 2026-10-24)
  const pulso = Math.max(1, b.u),
    d0 = Math.min(pulso, b.rem);
  b.rem -= d0;
  b.t = pulso / Math.max(0.05, b.u);
  hurtMonster(m, d0, "arco", 0, true);
  // v8.0: sangrar cansa como um golpe (o fôlego cai junto com a vida) e não deixa o fôlego voltar
  if (m.alive && folOn(m) && !(m.ko! > 0)) folDrain(m, (d0 * DANO.FOLEGO.golpe * m.folMax!) / Math.max(1, m.hpMax));
  if (m.bleed && m.bleed.rem <= 0.01) m.bleed = null;
}
export function atkSpeedMult() {
  /* v5.8 */
  return atkSpeedMultBase() * (dungeon.dazed! > 0 ? 1.25 : 1);
}
// etapa de atkSpeedMult: original
function atkSpeedMultBase() {
  const h = HERO()!;
  return 1 / (1 + Math.max(0, attrOf(h, "velocidade") - 5) * STAT.velAtk);
}
export function parryPerfectT() {
  return nv(HERO()!, "est_raio", PARRY_PERFECT);
}
export function herbTick() {
  return nv(HERO()!, "ervas_frescas", HERB_TICK);
}
/** Humano em combate mantém adrenalina por alguns segundos após o último contato. */
export function marcarCombateHumano(m: Monster | null | undefined) {
  if (m?.humano && dungeon.active && !dungeon.camp) {
    if (!(dungeon.combateHumanoT! > 0)) spawnDungeonToast("Adrenalina", dungeon.px, dungeon.py - 40, "#ffd477", 13);
    dungeon.combateHumanoT = 10;
  }
}
export function adrenalinaCusto() {
  return (dungeon.combateHumanoT || 0) > 0 ? 0.65 : 1;
}
export function adrenalinaRecuperacao() {
  return (dungeon.combateHumanoT || 0) > 0 ? 1.5 : 1;
}
/** Cura comum remove um episódio e encerra a lentidão atual. */
export function tratarDebilitacao() {
  const d = dungeon;
  if ((d.debilitadoN || 0) <= 0 && !(d.debilitadoT! > 0)) return false;
  d.debilitadoN = Math.max(0, (d.debilitadoN || 0) - 1);
  d.debilitadoT = 0;
  if ((d.gstam || 0) >= 25) d.exaustaoArmada = false;
  spawnDungeonToast("Você recuperou o fôlego", d.px, d.py - 34, "#b7e8c0", 12);
  return true;
}
/** Atualiza timers e conta cada esgotamento uma vez, durante combate humano. */
export function tickCombateHumano(dt: number) {
  const d = dungeon;
  d.combateHumanoT = Math.max(0, (d.combateHumanoT || 0) - dt);
  d.debilitadoJanela = Math.max(0, (d.debilitadoJanela || 0) - dt);
  d.debilitadoT = Math.max(0, (d.debilitadoT || 0) - dt);
  if (d.debilitadoJanela <= 0) d.debilitadoN = 0;
  if ((d.gstam || 0) >= 25) d.exaustaoArmada = false;
  if ((d.combateHumanoT || 0) > 0 && (d.gstam || 0) <= 0 && !d.exaustaoArmada) {
    d.exaustaoArmada = true;
    d.debilitadoN = d.debilitadoJanela > 0 ? (d.debilitadoN || 0) + 1 : 1;
    d.debilitadoJanela = 20;
    d.debilitadoT = 6;
    spawnDungeonToast(
      "Debilitado " + d.debilitadoN + "/3",
      d.px,
      d.py - 38,
      d.debilitadoN >= 3 ? "#ff806b" : "#ffd18a",
      14,
    );
  }
}
export function hurtPlayer(this: unknown, dmg: number, ang: number, m: Monster) {
  /* v6.1 — não morre e não há drops normais durante a cena */
  const d = dungeon;
  marcarCombateHumano(m);
  if ((d.debilitadoT || 0) > 0) dmg *= 1.35;
  if (ISC.on && m && m.intro) dmg = Math.round(d.hpMax * ISC_BOAR.dano);
  const hp0 = d.hp,
    r = hurtPlayerBase2.call(this, dmg, ang, m);
  if (m?.humano && d.hp < hp0 && d.gstam != null) {
    const custo = m.atk === "heavy" || m.atk === "heavy_arrow" ? 18 : 12;
    d.gstam = Math.max(0, d.gstam - custo);
    d.gregen = Math.max(d.gregen || 0, 0.85);
    if (d.gstam <= 0) d.runLock = true;
  }
  if (d.hp < hp0) mordidaCampanha(m); // v7.7 — campanha: a mordida do lobo rasga a roupa
  if (m?.humanoCC && d.hp < hp0 && !d.camp) {
    if ((d.debilitadoT || 0) > 0 && (d.debilitadoN || 0) >= 3) {
      d.down = Math.max(d.down || 0, 0.85);
      d.dazed = Math.max(d.dazed || 0, 1.1);
      d.debilitadoN = 0;
      d.debilitadoJanela = 0;
      spawnDungeonToast("Derrubado", d.px, d.py - 48, "#ff806b", 16);
    } else {
      // CC curto: prende a passada sem transformar todo golpe em uma derrubada longa.
      d.dazed = Math.max(d.dazed || 0, 0.45);
      spawnDungeonToast("Preso", d.px, d.py - 40, "#d8c4ff", 11);
    }
  }
  /* v7.7 — o alvo prioritário é automático: o último bicho que te atacou (ou que você feriu, em hurtMonster) */
  if (m && m.alive && !m.dummy) d.target = m;
  if (ISC.on && d.active) {
    const min = d.hpMax * 0.12;
    if (d.hp < min) {
      d.hp = min;
      d.dead = false;
    }
    if (m && m.intro) {
      ISC.gotHit = (ISC.gotHit || 0) + 1;
      ISC.hitT = 0;
      if (d.hp <= d.hpMax * ISC_BOAR.resgate && !ISC.rescueAt) ISC.rescueAt = ISC.t + 0.7;
      d.down = Math.max(d.down || 0, 1.8);
      d.dazed = Math.max(d.dazed || 0, 9);
      spawnDungeonToast("💥 Derrubado!", d.px, d.py - 52, "#ff8a6a", 17);
      introObj(
        econ.quiver.n > 0 ? "Levanta! Ele vai investir de novo" : "🏹 Sem flechas… e machucado",
        "ele é rápido demais…",
      );
    }
  }
  return r;
}
// etapa de hurtPlayer: original + v5.9 + v5.9.04
function hurtPlayerBase2(dmg: number, ang: number, m: Monster) {
  /* v5.9.04 */
  {
    const d = dungeon,
      M = d.mount;
    if (M && M.mounted && !d.training) {
      const share = 0.35;
      M.hp = Math.max(0, M.hp - dmg * share * 1.4);
      dmg *= 1 - share;
      if (M.hp < 25 + (4 - mountLv()) * 3 || (m && m.kind === "javalino")) {
        M.mounted = false;
        M.flee = 3;
        d.down = Math.max(d.down || 0, 0.8);
        spawnDungeonToast("🐾 " + mnt()!.name + " se assustou e te jogou!", d.px, d.py - 44, "#ff9a6a", 12);
      }
    }
  }
  /* v5.9 (antes) */
  const d = dungeon;
  hurtPlayerBase(dmg, ang, m);
  /* v5.9 (depois) */
  if (!d.training && !d.camp) d.wound = Math.min(d.hpMax * 0.85, (d.wound || 0) + dmg * SURV.woundK);
}
function hurtPlayerBase(dmg: number, ang: number, _m: Monster) {
  // feedback forte: número grande, flash, vinheta, chevron da direção, tremor e hit-stop
  const d = dungeon,
    big = dmg >= d.hpMax * 0.18;
  d.hp = Math.max(0, d.hp - dmg);
  d.sinceHurt = 0;
  d.hurtFlash = 0.45;
  d.hurtVig = Math.min(1, 0.45 + (dmg / d.hpMax) * 2.2);
  d.hpBarShake = 0.4;
  (d.hitDirs = d.hitDirs || []).push({ ang, life: 0.9 });
  spawnDungeonToast(
    "-" + dmg,
    d.px + (Math.random() - 0.5) * 10,
    d.py - 18,
    big ? "#ff3b3b" : "#ff6b6b",
    big ? 22 : 17,
  );
  // v8.1 (mantenedor: "responder mais quando recebo dano, sem poluir"): tremor mais forte, congelada em todo golpe e o
  // som ("hurt" não existia: tomar golpe era mudo); o anel vermelho em volta dela saiu (a borda e a seta mostram)
  shakeScreen(big ? 0.34 : 0.2, big ? 7 : 4.5);
  sfx("hurt");
  d.hitStop = Math.max(d.hitStop || 0, big ? 0.09 : 0.05);
  if (d.hp > 0 && d.hp < d.hpMax * 0.3 && !d.lowWarned) {
    d.lowWarned = true;
    spawnDungeonToast("VIDA BAIXA!", d.px, d.py - 52, "#ff9a9a", 14);
  }
  if (d.hp >= d.hpMax * 0.4) d.lowWarned = false;
}
export function drawHurtFx(dt: number) {
  const d = dungeon,
    c = TELAS.dCtx;
  if (d.hurtFlash! > 0) {
    d.hurtFlash! -= dt;
    c.beginPath();
    c.fillStyle = "rgba(255,40,40," + Math.max(0, (d.hurtFlash! / 0.45) * 0.65) + ")";
    c.arc(d.px, d.py, 13, 0, 7);
    c.fill();
  }
  if (d.hitDirs)
    for (let i = d.hitDirs.length - 1; i >= 0; i--) {
      const h = d.hitDirs[i];
      h.life -= dt;
      if (h.life <= 0) {
        d.hitDirs.splice(i, 1);
        continue;
      }
      const a = Math.min(1, h.life / 0.6),
        r = 26 + (0.9 - h.life) * 8;
      c.save();
      c.translate(d.px + Math.cos(h.ang) * r, d.py + Math.sin(h.ang) * r);
      c.rotate(h.ang + Math.PI);
      c.fillStyle = "rgba(255,70,70," + a + ")";
      c.beginPath();
      c.moveTo(7, 0);
      c.lineTo(-5, -7);
      c.lineTo(-2, 0);
      c.lineTo(-5, 7);
      c.closePath();
      c.fill();
      c.restore();
    }
  const el = document.getElementById("hit-vig");
  if (el) {
    d.hurtVig = Math.max(0, (d.hurtVig || 0) - dt * 1.6);
    const low = d.hp > 0 && d.hp < d.hpMax * 0.3 ? 0.28 + 0.14 * Math.sin(performance.now() / 260) : 0;
    el.style.opacity = Math.max(d.hurtVig, low).toFixed(2);
  }
}
export function wolfTactics(m: Monster, dt: number, d: number, T: number) {
  // rodear, fintar, recuar e só então atacar
  const boss = !!m.boss,
    ux = (dungeon.px - m.x) / (d || 1),
    uy = (dungeon.py - m.y) / (d || 1),
    lo = T,
    hiX = dungeon.cols * T - T,
    hiY = dungeon.rows * T - T;
  if (m.cmt == null) {
    m.cmt = 0.5 + Math.random() * 1.4;
    m.orb = Math.random() < 0.5 ? 1 : -1;
    m.pref = T * (1.7 + Math.random() * 1.0);
    m.mt = 0;
    m.retreat = 0;
  }
  const fz = m.low === "frenzy" || (m.desespero! > 0 && !m.neutral); // v8.1: a fúria de quem levantou (FOLEGO.desespero)
  m.cmt -= dt * (fz ? 1.9 : 1);
  m.mt! -= dt;
  if (m.hop! > 0) m.hop! -= dt;
  const sp = (m.spd || 38) * dt * (m.slow! > 0 ? 0.45 : 1) * (fz ? 1.25 : 1);
  const mv = (vx: number, vy: number, k: number) => {
    const n = Math.hypot(vx, vy) || 1;
    m.x = Math.max(lo, Math.min(hiX, m.x + (vx / n) * sp * k));
    m.y = Math.max(lo, Math.min(hiY, m.y + (vy / n) * sp * k));
  };
  if (m.retreat! > 0) {
    m.retreat! -= dt;
    m.st = "chase";
    // v8.1 (mantenedor: "se afasta de maneira estranha, coloca ele rodeando, não andando de costas"): abre distância
    // num arco, de lado, no sentido em que já rodeava
    mv(-uy * m.orb! - ux * 0.6, ux * m.orb! - uy * 0.6, 1.3);
    return true;
  } // afasta-se (às vezes com um pulinho)
  const near = d < T * (boss ? 1.1 : 0.8);
  if (near && (m.cmt <= 0 || d < T * 0.45)) {
    m.st = "windup";
    m.atk = "bite";
    m.wuTot = m.t = (boss ? 0.45 : 0.38) * (fz ? 0.75 : 1);
    m.parry = null;
    m.ang = Math.atan2(dungeon.py - m.y, dungeon.px - m.x);
    return true;
  }
  const noPounce = m.slow! > 0 && synOn(HERO()!, "danca_do_escudo");
  if (
    !(m.pcd! > 0) &&
    !noPounce &&
    m.cmt <= 0 &&
    d >= T * 1.3 &&
    d <= T * (boss ? 3.2 : 2.6) &&
    Math.random() < dt * 2.2
  ) {
    m.st = "windup";
    m.atk = "pounce";
    m.wuTot = m.t = boss ? 0.95 : 0.85;
    m.parry = null;
    m.locked = false;
    m.ang = Math.atan2(dungeon.py - m.y, dungeon.px - m.x);
    return true;
  }
  if (m.cmt <= 0) {
    m.st = "chase";
    mv(ux, uy, 1.15);
    return true;
  } // decidiu atacar: investe
  if (m.mt! <= 0) {
    m.mt = 0.8 + Math.random() * 1.6;
    if (Math.random() < 0.35) m.orb! *= -1;
    if (Math.random() < 0.22) {
      m.retreat = 0.3 + Math.random() * 0.35;
      m.hop = 0.3;
    }
  }
  let sx = 0,
    sy = 0;
  for (const o of dungeon.monsters) {
    if (o === m || !o.alive) continue;
    const dx = m.x - o.x,
      dy = m.y - o.y,
      dd = Math.hypot(dx, dy);
    if (dd < 26 && dd > 0.1) {
      sx += dx / dd;
      sy += dy / dd;
    }
  } // não se amontoam
  const rad = Math.max(-1, Math.min(1, (d - m.pref!) / T));
  m.st = "chase";
  mv(-uy * m.orb! * 0.9 + ux * rad * 0.9 + sx * 0.7, ux * m.orb! * 0.9 + uy * rad * 0.9 + sy * 0.7, 1.05);
  return true;
}
export function runCostMult() {
  const r = runCostMultBase();
  /* v6.2 */
  try {
    return r * plateMult(HERO()!) * adrenalinaCusto();
  } catch (_) {
    return r;
  }
}
function runCostMultBase() {
  const h = HERO()!;
  if (dungeon.boost! > 0 && synOn(h, "danca_do_escudo")) return 0;
  return nv(h, "pe_ligeiro", 1);
}
export function onBlockOk(m: Monster) {
  const h = HERO()!,
    d = dungeon,
    t = nv(h, "guarda_firme", 1.2);
  applySlow(m, t);
  const ar = nv(h, "est_agua", 0);
  if (ar > 0)
    for (const o of d.monsters)
      if (o !== m && o.alive && Math.hypot(o.x - d.px, o.y - d.py) < d.tile * ar) applySlow(o, t);
  if (nodeRank(h, "impulso_escudo")) d.boost = Math.max(d.boost || 0, nv(h, "impulso_escudo", 0));
  if (synOn(h, "ritmo_de_ferro")) d.riposte = nv(h, "contra_golpe", 2);
}
export function onPerfectParry(m: Monster) {
  const h = HERO()!,
    d = dungeon;
  if (nodeRank(h, "corte_sangrento")) {
    applyBleed(m, nv(h, "corte_sangrento", 0));
  }
  const nu = nv(h, "est_nularis", 0);
  if (nu) m.pcd = Math.max(m.pcd || 0, nu);
  if (nodeRank(h, "contra_golpe")) d.riposte = nv(h, "contra_golpe", 0);
  const ar = nv(h, "est_ar", 0);
  if (ar) d.boost = Math.max(d.boost || 0, ar);
}
function statusBar(c: CanvasRenderingContext2D, m: Monster, f: number, col: string, dy: number) {
  const w = 24;
  c.fillStyle = "rgba(0,0,0,.55)";
  c.fillRect(m.x - w / 2, m.y + dy, w, 3);
  c.fillStyle = col;
  c.fillRect(m.x - w / 2, m.y + dy, w * Math.max(0, Math.min(1, f)), 3);
}
export function drawStatus(c: CanvasRenderingContext2D, m: Monster) {
  c.save();
  c.textAlign = "center";
  if (m.slow! > 0) {
    c.font = "12px serif";
    c.fillText("🐌", m.x - 13, m.y - 22);
    statusBar(c, m, m.slow! / (m.slowMax || 1), "#9fe3ff", -36);
  }
  if (m.stun! > 0 && !D3.gl) {
    // v8.0: no 3D as estrelas são peças da cena (render/gl/status_fx.ts) e fazem a contagem; aqui só no 2D
    const a = performance.now() / 200;
    c.font = "11px serif";
    for (let i = 0; i < 3; i++)
      c.fillText("⭐", m.x + Math.cos(a + i * 2.09) * 13, m.y - 27 + Math.sin(a + i * 2.09) * 4);
    statusBar(c, m, m.stun! / (m.stunMax || 1), "#ffe08a", -41);
  }
  c.restore();
}
