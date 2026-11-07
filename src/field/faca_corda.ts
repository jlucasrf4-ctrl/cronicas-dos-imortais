/* ==== Fase 4 — faca e corda: estocada, corte em cone, finalizar, laço com resistência (v6.0–v7.3) ==== */
import { dungeon, TELAS } from "../core/state.ts";
import {
  KNIFE_KEYS,
  ROPE,
  LACO,
  DOMA,
  FACA2,
  COMBO_WINDOW,
  DANO,
  FOL_HEROI,
  ALFA,
  FINALIZAR,
} from "../data/combate.ts";
import { ensureInv } from "../items/inventario.ts";
import { ensureEquip } from "../items/equipamento.ts";
import { qvInv } from "../expedicao/preparo.ts";
import { spawnDungeonToast, reveal } from "./masmorra.ts";
import { DMG, plateMult, ensureFol, folPct, folCap } from "./dano.ts";
import { cravPress, finMark, folOn } from "./tipos.ts";
import { profLv } from "../hero/proficiencias.ts";
import { aimAngle, wolfBody, hurtMonster, bodyDist, monR, meleeDmg } from "./acertos.ts";
import { sfx, shakeScreen, addRing } from "./chao.ts";
import { angDiff } from "../core/util.ts";
import { applyBleed, atkSpeedMult } from "./combate.ts";
import { gainSkill } from "../hero/nivel.ts";
import { MOB } from "../ui/celular.ts";
import { loboDominado, loboLevantou } from "../campanha/lobos.ts";
import { facaNoCinto, gastarFacaDoCinto, qualquerFacaNoCinto } from "../items/cinto.ts";
import { D3 } from "./projecao.ts";
import type { Hero, Monster, Repasse } from "../core/tipos.ts";

function monVuln(m: Monster) {
  // reescrita na v7.2; v7.7: o domado de pé (segue você na corda) não é finalizado, só o caído (senão o E na saída
  // matava o lobo que vinha atrás)
  return !!(
    m &&
    m.alive &&
    ((m.bound && m.bound.dom && m.bound.fase !== "domado") || m.ko! > 0 || (m.humano && !m.bandido && m.stun! > 0))
  );
}

/* ---- finalizar ---- */
/** v7.7 — alcance do finalizar, em tiles, contado da borda do corpo do bicho (era 1,5 tile do centro: longe demais). */
const FIN_ALC = 0.6;
export function finishTarget() {
  const d = dungeon;
  if (!d.active || d.camp) return null;
  let best = null,
    bd = d.tile * FIN_ALC;
  for (const m of d.monsters)
    if (monVuln(m)) {
      const B = wolfBody(m),
        q = bodyDist(B, d.px, d.py).d - B.r;
      if (q < bd) {
        bd = q;
        best = m;
      }
    }
  return best;
}

/* ==== v6.1.2 — sem arma corpo a corpo não ataca; faca na mochila vira o ataque básico se for a única arma; tremor travado no diálogo ==== */
export function knifeIn(h: Hero) {
  if (!h) return null;
  const e = ensureEquip(h);
  if (e.maoD && KNIFE_KEYS.includes(e.maoD.def.key)) return e.maoD;
  const doCinto = qualquerFacaNoCinto(h); // v7.7
  if (doCinto) return doCinto;
  for (const inv of [ensureInv(h), qvInv(h)]) {
    const it = inv.items.find((i) => i.def && KNIFE_KEYS.includes(i.def.key));
    if (it) return it;
  }
  return null;
}
export function knifeActive(h: Hero) {
  const e = ensureEquip(h);
  if (e.maoD) return KNIFE_KEYS.includes(e.maoD.def.key) ? e.maoD : null;
  return knifeIn(h);
}

export function ropeItem(h: Hero) {
  for (const inv of [ensureInv(h), qvInv(h)]) {
    const it = inv.items.find((i) => i.def.key === "corda");
    if (it) {
      if (it.uses == null) it.uses = ROPE.uses;
      return { it, inv };
    }
  }
  return null;
}
export const FIN = { on: false, extra: false };

/* ==== v7.3 — faca: esquerdo = corte curto num cone pequeno (1º bicho leva tudo, o marcado leva 30%) · direito = estocada que pode cravar (sem parry) · armas de área: dano dividido pela quantidade de alvos ==== */
/** Um acerto guardado durante um golpe em área (hurtMonsterTipos), cobrado no fim com o desconto por alvos. */
type GolpeEmArea = [m: Monster, dmg: number, skill: string, xp: number, src: string | null, key: string | null];
export const AREA = { q: null as GolpeEmArea[] | null, k: (n: number) => 1 / (1 + (n - 1) / 3) }; // 1 alvo 100% · 2 → 75% · 3 → 60% · 4 → 50%

function ropeWear(h: Hero, n: number) {
  const r = ropeItem(h);
  if (!r) return;
  r.it.uses! -= n;
  if (r.it.uses! <= 0) {
    r.inv.items.splice(r.inv.items.indexOf(r.it), 1);
    spawnDungeonToast("🪢 A corda gastou e arrebentou", dungeon.px, dungeon.py - 44, "#ffb37a", 12);
  }
}
export function canBind(m: Monster) {
  /* v6.9 — laço: basta o bicho estar MARCADO (alvo) — não precisa estar com pouca vida */
  {
    const d = dungeon;
    if (m && m.alive && !m.dummy && (d.target === m || d.foco === m)) return true; // v7.7: alvo ou foco
  }
  if (!m || !m.alive || m.dummy) return false;
  if (m.ko! > 0 || (m.stun! > 0 && m.st === "recover")) return true;
  if (m.boss) return false;
  return m.hp / m.hpMax < 0.4;
}
export function monStr(m: Monster) {
  return m.boss ? 2.2 : m.kind === "javalino" ? 1.7 : 1;
}
export function applyStunRaw(m: Monster, t: number) {
  m.st = "recover";
  m.t = t;
  m.stun = t;
  m.stunMax = t;
  m.parry = null;
}

/* ---- 🔪 estocada curta ---- */
export function knifeStab(this: unknown) {
  /* v6.2 */
  const d = dungeon;
  if (d.crav) {
    cravPress();
    return;
  }
  if (d.noAtk! > 0) return;
  const o = DMG.src;
  DMG.src = "stab";
  try {
    return knifeStabBase.apply(this, arguments as Repasse);
  } finally {
    DMG.src = o;
  }
}
// etapa de knifeStab: original + v6.1.2
function knifeStabBase() {
  /* v6.1.2 */
  {
    const d = dungeon;
    if (d.active && !knifeIn(d.hero!)) {
      if (!(d._noKnT! > performance.now())) {
        d._noKnT = performance.now() + 1500;
        spawnDungeonToast("Você não tem faca 🔪", d.px, d.py - 34, "#ffb37a", 12);
      }
      return;
    }
  }
  const d = dungeon;
  if (!d.active || d.dead || d.invOpen || d.modalOpen || d.camp || d.guard || d.finish) return;
  if ((d.kcd || 0) > 0) return;
  const h = d.hero!,
    T = d.tile,
    lv = profLv(h, "faca");
  let ang = aimAngle();
  if (!isFinite(ang)) ang = 0;
  d.kcd = 0.3;
  d.cd = Math.max(d.cd || 0, 0.18);
  reveal();
  sfx("swing");
  d.slash = { ang, life: 0.14, step: 0, half: 0.32, reach: 0.7, ox: d.px, oy: d.py, thrust: true, knife: true };
  d.px = Math.max(T, Math.min(d.cols * T - T, d.px + Math.cos(ang) * 3));
  d.py = Math.max(T, Math.min(d.rows * T - T, d.py + Math.sin(ang) * 3));
  d.slash.ox = d.px;
  d.slash.oy = d.py;
  let hit = 0;
  for (const m of d.monsters) {
    if (!m.alive) continue;
    const B = wolfBody(m),
      q = bodyDist(B, d.px, d.py),
      dx = q.x - d.px,
      dy = q.y - d.py,
      dist = Math.hypot(dx, dy);
    if (dist - B.r > T * 0.7) continue;
    if (dist > B.r && angDiff(Math.atan2(dy, dx), ang) > 0.32 + Math.asin(Math.min(1, B.r / dist))) continue;
    if (monVuln(m) && dist < T * 1.4) {
      finishStart(m);
      return;
    }
    const dmg = (1 + lv * 0.35 + h.attrs.forca * 0.08 + Math.random() * 1.1) * 0.8;
    d.fx!.push({ x: m.x, y: m.y, life: 0.2 });
    hurtMonster(m, dmg, "faca", 2);
    hit++;
    if (m.alive && Math.random() < 0.25 + lv * 0.02) {
      applyBleed(m, dmg * 0.7);
      spawnDungeonToast("🩸", m.x, m.y - 30, "#ff6a6a", 15);
    }
    break;
  }
  if (!hit) gainSkill(h, "faca", 0.2);
}
export function finishStart(m: Monster) {
  /* v6.1.2; v7.7: só com uma faca no cinto (items/cinto.ts) */
  if (!facaNoCinto(dungeon.hero!)) {
    spawnDungeonToast(
      qualquerFacaNoCinto(dungeon.hero!)
        ? "A faca do cinto está sem fio: conserte na Forja"
        : "Para finalizar, leve uma faca no cinto 🔪",
      dungeon.px,
      dungeon.py - 34,
      "#ffb37a",
      12,
    );
    return;
  }
  const d = dungeon,
    lv = profLv(d.hero!, "faca");
  if (d.finish || !monVuln(m)) return;
  d.finish = { m, t: 0, dur: Math.max(0.35, 0.75 - lv * 0.04), ang: Math.atan2(m.y - d.py, m.x - d.px) };
  d.guard = false;
  d.charging = false;
  // v8.0: no lugar da pose de pegar item, o golpe final (o 3º do combo) sai em finishTick; o zoom vem em cravZoom
}
export function finishTick(dt: number) {
  const d = dungeon,
    F = d.finish;
  if (!F) return;
  const m = F.m;
  F.t += dt;
  d.moveTarget = null;
  const tx = m.x - Math.cos(F.ang) * d.tile * 0.55,
    ty = m.y - Math.sin(F.ang) * d.tile * 0.55;
  d.px += (tx - d.px) * Math.min(1, dt * 10);
  d.py += (ty - d.py) * Math.min(1, dt * 10);
  // v8.0: o golpe final (3º do combo) começa antes, para o pico da animação cair no acerto
  if (F.t >= F.dur - FINALIZAR.pico && !F.golpe) {
    F.golpe = true;
    d.slash = { ang: F.ang, life: 0.2, step: 2, half: 0.3, reach: 0.6, ox: d.px, oy: d.py, thrust: true, knife: true };
    sfx("swing");
  }
  if (F.t >= F.dur && !F.done) {
    F.done = true;
    const h = d.hero!,
      lv = profLv(h, "faca");
    FIN.on = true;
    FIN.extra = Math.random() < 0.08 + lv * 0.02;
    // v8.0: lobo/javali com muita vida não morre no finalizar: leva FINALIZAR.golpe da vida e levanta
    const mata = !m.boss && (m.humano || m.critter || m.hp <= m.hpMax * FINALIZAR.mata);
    try {
      if (m.bound) ropeRelease(m, false);
      m.ko = 0;
      // v7.7: o Alfa não é finalizado: leva ALFA.finalizador da vida máxima (sem morrer disso) e levanta
      if (!mata) {
        // exato, sem os multiplicadores do golpe (caído, crítico, tipo de dano): nunca mata
        const n = Math.max(0, Math.min(Math.round(m.hpMax * (m.boss ? ALFA.finalizador : FINALIZAR.golpe)), m.hp - 1));
        m.hp -= n;
        m.hitT = 0.18;
        spawnDungeonToast("-" + n, m.x, m.y - 26, "#ffe08a", 16);
      } else hurtMonster(m, m.hp + 999, "faca", 6);
    } finally {
      FIN.on = false;
    }
    shakeScreen(0.22, 5);
    d.hitStop = Math.max(d.hitStop || 0, FINALIZAR.congela);
    d.lenta = { k: FINALIZAR.lenta, ate: performance.now() + FINALIZAR.lentaMs };
    d.fx!.push({ x: m.x, y: m.y, life: 0.4 });
    spawnDungeonToast(
      m.boss ? "🔪 GOLPE NO ALFA" : mata ? "🔪 FINALIZADO" : "🔪 GOLPE FUNDO",
      m.x,
      m.y - 40,
      "#ffe08a",
      mata ? 20 : 16,
    );
    gainSkill(h, "faca", 8);
    const gasto = gastarFacaDoCinto(h); // v7.7: a faca do cinto gasta (a Simples quebra; items/cinto.ts)
    if (gasto) spawnDungeonToast(gasto, d.px, d.py - 52, "#e8c34a", 12);
    addRing(m.x, m.y, "#ffe08a", 34, 0.35, 3);
    sfx("perfect");
  }
  if (F.t >= F.dur + 0.25) d.finish = null;
}

/* ---- 🪢 laço ---- */
export function ropeThrow() {
  const d = dungeon;
  if (!d.active || d.dead || d.invOpen || d.modalOpen || d.camp || d.finish || d.rope) return;
  const h = d.hero!;
  if (lacoPuxao()) return;
  const R = ropeItem(h);
  if (!R) {
    spawnDungeonToast("Sem corda 🪢 (compre na preparação ou trance na carpintaria)", d.px, d.py - 36, "#ffb37a", 11);
    return;
  }
  let ang = aimAngle();
  if (!isFinite(ang)) ang = 0;
  const T = d.tile;
  let best = null,
    bs = 1e9; // ajuda de mira: prefere bicho vulnerável perto da direção
  for (const m of d.monsters) {
    if (!m.alive) continue;
    const dd = Math.hypot(m.x - d.px, m.y - d.py);
    if (dd > T * ROPE.range) continue;
    const a = angDiff(Math.atan2(m.y - d.py, m.x - d.px), ang);
    const sc = a * 3 + (dd / T) * 0.2 - (canBind(m) ? 1 : 0);
    if (a < 0.6 && sc < bs) {
      bs = sc;
      best = m;
    }
  }
  if (!best && typeof MOB !== "undefined" && MOB.on) {
    for (const m of d.monsters) {
      if (!m.alive) continue;
      const dd = Math.hypot(m.x - d.px, m.y - d.py);
      if (dd > T * ROPE.range) continue;
      const sc = dd - (canBind(m) ? T * 3 : 0);
      if (sc < bs) {
        bs = sc;
        best = m;
      }
    }
  }
  if (best) ang = Math.atan2(best.y - d.py, best.x - d.px);
  d.rope = { x: d.px, y: d.py, ang, dist: 0, max: T * ROPE.range };
  reveal();
  sfx("swing");
}
export function ropeFlyTick(dt: number) {
  ropeFlyTickBase(dt);
  /* v7.2 — ao laçar: corda com comprimento limitado */
  try {
    const d = dungeon;
    for (const m of d.monsters)
      if (m.alive && m.bound && !m.bound._ok) {
        m.bound._ok = true;
        m.bound.len = lacoLen(d.tile, Math.hypot(m.x - d.px, m.y - d.py));
      }
  } catch (_) {}
}
function ropeFlyTickBase(dt: number) {
  const d = dungeon,
    R = d.rope;
  if (!R) return;
  const T = d.tile,
    st = ROPE.speed * dt;
  R.dist += st;
  R.x += Math.cos(R.ang) * st;
  R.y += Math.sin(R.ang) * st;
  for (const m of d.monsters) {
    if (!m.alive) continue;
    if (Math.hypot(m.x - R.x, m.y - R.y) > monR(m) + 6) continue;
    d.rope = null;
    if (canBind(m)) {
      m.bound = { t: 0, len: Math.max(T * 1.6, Math.hypot(m.x - d.px, m.y - d.py)), tire: 0 };
      m.st = "recover";
      ropeWear(d.hero!, 1);
      gainSkill(d.hero!, "domador", 3);
      spawnDungeonToast(
        typeof MOB !== "undefined" && MOB.on ? "🪢 Laçado! Toque 🪢 para puxar" : "🪢 Laçado! Aperte G para puxar",
        m.x,
        m.y - 36,
        "#ffe08a",
        15,
      );
      sfx("perfect");
      shakeScreen(0.08, 2);
    } else {
      spawnDungeonToast(
        m.boss ? "O Alfa é forte demais — desmaie ele antes" : "Escapou do laço! (enfraqueça antes)",
        m.x,
        m.y - 34,
        "#ffb37a",
        12,
      );
      sfx("hitlite");
    }
    return;
  }
  if (R.dist >= R.max) {
    d.rope = null;
    spawnDungeonToast("Errou o laço", R.x, R.y - 16, "#c9b88a", 11);
  }
}
function ropeRelease(m: Monster, broke: boolean) {
  m.bound = null;
  if (broke) {
    m.st = "chase";
    m.fleeT = 0;
  }
}
export function ropeTug(_m?: Monster, _dt?: number) {
  // reescrita na v7.2 (desde então ignora o bicho e o dt que o chamador passa)
}
/* desenho: corda voando, corda presa com tensão, desmaio e aviso de finalizar */
export function cordaDraw2D() {
  const d = dungeon,
    c = TELAS.dCtx,
    t = performance.now() / 1000;
  if (!d.active || d.camp) return;
  const R = d.rope;
  if (R) {
    c.save();
    c.strokeStyle = "#c9a46a";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(d.px, d.py - 6);
    c.quadraticCurveTo((d.px + R.x) / 2, (d.py + R.y) / 2 - 10, R.x, R.y);
    c.stroke();
    c.beginPath();
    c.ellipse(R.x, R.y, 7, 4, t * 12, 0, 6.283);
    c.stroke();
    c.restore();
  }
  for (const m of d.monsters) {
    if (!m.alive) continue;
    if (m.bound) {
      const B = m.bound,
        tense = Math.min(1, Math.hypot(m.x - d.px, m.y - d.py) / B.len),
        col = !B.dom && (d.gstam == null ? 100 : d.gstam) < 25 ? "#ff7a5a" : "#d8b47a"; // v7.7: vermelha = você quase sem fôlego
      c.save();
      c.strokeStyle = col;
      c.lineWidth = 2.4;
      c.beginPath();
      c.moveTo(d.px, d.py - 6);
      c.quadraticCurveTo((d.px + m.x) / 2, (d.py + m.y) / 2 + (1 - tense) * 14, m.x, m.y - 4);
      c.stroke();
      c.beginPath();
      c.ellipse(m.x, m.y - 4, 9, 5, 0, 0, 6.283);
      c.stroke();
      /* v7.7 — a barra de fuga saiu: a disputa aparece nos dois círculos de fôlego (o seu e o do bicho) */
      c.font = "10px Lora,serif";
      c.textAlign = "center";
      c.fillStyle = "#fff1c2";
      c.fillText(
        B.dom
          ? B.fase === "domado"
            ? "🐺 domado · G puxa · segure G solta"
            : "🪢 caído · segure G solta"
          : B.pull! > 0
            ? "💪 puxão!"
            : typeof MOB !== "undefined" && MOB.on
              ? "toque 🪢 para puxar"
              : "aperte G para puxar",
        m.x,
        m.y - 50,
      );
      c.restore();
    }
    if (m.ko! > 0 && !D3.gl) {
      // v8.0: no 3D as estrelas do caído são peças da cena (render/gl/status_fx.ts)
      c.save();
      c.font = "14px serif";
      c.textAlign = "center";
      for (let i = 0; i < 3; i++) {
        const a = t * 3 + i * 2.1;
        c.fillText(i % 2 ? "💫" : "⭐", m.x + Math.cos(a) * 14, m.y - 28 + Math.sin(a) * 5);
      }
      c.restore();
    }
    if (monVuln(m) && !d.finish && finishTarget() === m) finMark(c, m, t);
  }
  if (d.finish) {
    const F = d.finish,
      k = Math.min(1, F.t / F.dur);
    c.save();
    c.strokeStyle = "rgba(255,224,138," + (0.4 + 0.5 * k) + ")";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(F.m.x, F.m.y, 22, -Math.PI / 2, -Math.PI / 2 + k * 6.283);
    c.stroke();
    c.restore();
  }
}
export function withBagKnife<T>(fn: () => T) {
  const d = dungeon,
    h = d.hero!,
    e = ensureEquip(h);
  if (e.maoD || d.spearOut) return fn();
  const k = knifeIn(h);
  if (!k) {
    if (!(d._noWpnT! > performance.now())) {
      d._noWpnT = performance.now() + 1500;
      spawnDungeonToast("Sem arma corpo a corpo — use o arco (Q)", d.px, d.py - 34, "#ffb37a", 12);
    }
    return;
  }
  e.maoD = k;
  try {
    return fn();
  } finally {
    if (ensureEquip(h).maoD === k) e.maoD = null;
  }
}

/* ==== v7.2 — laço com resistência: o bicho puxa e tenta fugir; aperte G de vez em quando (gasta stamina) para cansá-lo; dominado ele fica parado e você anda com ele na corda ==== */
/* v7.7 — dominado em 2 estados (LACO.caido…soltar): caído (deitado, arrastado) → levanta domado (segue andando, o
   fôlego volta, o interno sobe até o pinote, o G baixa: tabela DOMA); sem fôlego para segurar o pinote volta o cabo
   de guerra; zerado, cai de novo. Segurar G solta. */
function lacoLen(T: number, dist: number) {
  return Math.max(T * 1.8, Math.min(T * LACO.corda, dist));
}
/* só dá para finalizar com E se estiver desmaiado ou DOMINADO na corda */
/* o tick antigo (segurar G) sai; tudo acontece em lacoTick */
export function lacoPuxao() {
  const d = dungeon,
    m = d.monsters.find((o) => o.alive && o.bound);
  if (!m) return false;
  const B = m.bound!,
    h = d.hero!,
    now = performance.now() / 1000;
  /* v7.7 — dominado: caído, o G só conta para segurar (soltar a corda, lacoTick); domado, o puxão baixa o fôlego */
  if (B.dom) {
    B.segura = 0;
    if (B.fase !== "domado") return true;
  }
  if (now - (B.lastP || 0) < LACO.puxaoCd) return true;
  B.lastP = now;
  if (d.gstam != null && d.gstam < 8) {
    spawnDungeonToast("Sem stamina!", d.px, d.py - 36, "#ff9a7a", 12);
    sfx("fail");
    return true;
  }
  if (d.gstam != null) {
    d.gstam = Math.max(0, d.gstam - LACO.puxaoStam * plateMult(h));
    d.gregen = 0.7;
  }
  ensureFol(m);
  const lv = profLv(h, "domador"),
    q = (LACO.puxaoFol + lv * 0.02 + h.attrs.forca * 0.004) / Math.sqrt(monStr(m));
  B.pull = 0.25;
  const ax = m.x - d.px,
    ay = m.y - d.py,
    dd = Math.hypot(ax, ay) || 1;
  m.x -= (ax / dd) * 12;
  m.y -= (ay / dd) * 12;
  sfx("swing");
  shakeScreen(0.05, 1.5);
  gainSkill(h, "domador", 1);
  if (B.dom) {
    // domado: tira primeiro do interno (o que enche até o pinote, DOMA), no mínimo do fôlego; zerar o fôlego faz ele
    // cair de novo (lacoTick)
    cansarBicho(m, (DOMA.puxao + lv * 0.02) / Math.sqrt(monStr(m)));
    return true;
  }
  cansarBicho(m, q); // v7.7: o puxão também gasta primeiro o interno
  return true;
}
/* ---------- v7.7 — cabo de guerra: primeiro o fôlego interno (até 25%), depois o de fora ---------- */
/** Tira do bicho `frac` do fôlego total: da reserva (folRes) até o mínimo, o resto do fôlego. */
function cansarBicho(m: Monster, frac: number) {
  if (!folOn(m)) return;
  const F = DANO.FOLEGO,
    res = m.folRes == null ? 1 : m.folRes;
  if (res > F.tetoMin) {
    const t = Math.min(frac, res - F.tetoMin);
    m.folRes = res - t;
    frac -= t;
  }
  m.fol = Math.max(0, Math.min(m.fol!, folCap(m)) - frac * m.folMax!);
  m.folT = 0;
}
/** Tira `n` do seu fôlego: do interno (gint) até o mínimo, o resto do fôlego; e ele não volta enquanto isso. */
function cansarHeroi(n: number) {
  const d = dungeon,
    H = FOL_HEROI;
  if (d.gstam == null) return;
  let gi = d.gint == null ? 100 : d.gint;
  if (gi > H.minLaco) {
    const t = Math.min(n, gi - H.minLaco);
    gi -= t;
    n -= t;
  }
  d.gint = gi;
  d.gstam = Math.max(0, d.gstam - n);
  d.gregen = Math.max(d.gregen || 0, 0.5);
}
export function lacoTick(dt: number) {
  const d = dungeon,
    T = d.tile,
    h = d.hero!;
  for (const m of d.monsters) {
    if (!m.alive || !m.bound) continue;
    const B = m.bound;
    B.t += dt;
    if (B.pull! > 0) B.pull! -= dt;
    if (B.len > T * LACO.corda) B.len = T * LACO.corda;
    if (!B.dom && (m.ko! > 0 || (folOn(m) && m.fol! <= 0))) {
      const antes = !!B.fase; // já foi dominado nesta corda (rebelou e caiu de novo)
      B.dom = true;
      B.fase = "caido";
      B.caiT = LACO.caido;
      B.segura = undefined;
      spawnDungeonToast(antes ? "🪢 Caiu de novo" : "🪢 Dominado!", m.x, m.y - 40, "#ffe08a", 13);
      sfx("perfect");
      gainSkill(h, "domador", antes ? 2 : 4);
      if (!antes) loboDominado(m); // v7.7 — campanha: o lobo do Caçador (finalizar ou esperar levantar)
    }
    let ax = m.x - d.px,
      ay = m.y - d.py,
      dd = Math.hypot(ax, ay) || 1,
      ux = ax / dd,
      uy = ay / dd;
    if (B.dom) {
      /* v7.7 — segurar G solta a corda (o toque é o puxão) */
      if (d.ropeHold && B.segura != null) {
        // conta só o G apertado depois de dominado (lacoPuxao zera): quem segurava no cabo de guerra não solta
        B.segura += dt;
        if (B.segura >= LACO.soltar) {
          ropeRelease(m, false);
          m.ko = B.fase === "domado" ? 0 : Math.min(m.ko || 0, 3);
          d.ropeHold = false;
          spawnDungeonToast("🪢 Soltou a corda", d.px, d.py - 36, "#e8d6a8", 12);
          continue;
        }
      } else if (!d.ropeHold) B.segura = undefined;
      if (B.fase === "domado") {
        /* v7.7 — domado: de pé, segue você; o fôlego volta aos poucos (o puxão baixa) */
        m.ko = 0;
        m.st = "recover";
        m.t = 0.3;
        m.parry = null;
        m.folT = 0; // o fôlego volta só por aqui (não pelo folTick)
        m.fol = Math.min(folCap(m), m.fol! + LACO.volta * m.folMax! * dt);
        /* v7.7 — DOMA: o interno sobe sozinho até ele desistir (teima); cheio = pinote */
        if (B.teima == null) B.teima = DOMA.teima;
        if (B.teima > 0) {
          B.teima = Math.max(0, B.teima - dt);
          if (B.teima <= 0) spawnDungeonToast("🐺 Desistiu de fugir", m.x, m.y - 40, "#ffe08a", 13);
          else m.folRes = Math.min(1, (m.folRes ?? 1) + DOMA.sobe * dt);
        }
        if (m.fol <= 0) {
          B.fase = "caido";
          B.caiT = LACO.caido;
          m.ko = 1.5;
          spawnDungeonToast("🪢 Caiu de cansaço", m.x, m.y - 40, "#e8d6a8", 12);
        } else if (B.teima > 0 && (m.folRes ?? 1) >= DOMA.cheio) {
          // pinote: um tranco para longe de você; sem fôlego para segurar, ele escapa para o cabo de guerra
          m.folRes = DOMA.depois;
          B.pinotes = (B.pinotes || 0) + 1;
          // ele salta para longe e a corda arranca você junto (metade cada um)
          m.x += ux * DOMA.salto * 0.5;
          m.y += uy * DOMA.salto * 0.5;
          d.px += ux * DOMA.salto * 0.5;
          d.py += uy * DOMA.salto * 0.5;
          m._yaw = Math.atan2(uy, ux);
          const custo = DOMA.custo * monStr(m) * plateMult(h);
          shakeScreen(0.1, 3);
          if (d.gstam != null && d.gstam < custo) {
            B.dom = false; // cabo de guerra de novo (o ramo de baixo, no próximo quadro)
            B.deb = LACO.debate[0];
            spawnDungeonToast("💢 Pinote! Escapou do controle · cabo de guerra", m.x, m.y - 40, "#ffb37a", 13);
            sfx("guardbreak");
          } else {
            cansarHeroi(custo);
            spawnDungeonToast("💢 Pinote!", m.x, m.y - 40, "#ffb37a", 13);
            sfx("hitlite");
          }
        } else {
          const lon = dd - LACO.segue * T;
          if (lon > 0) {
            const sp = Math.min(LACO.velMax, lon * LACO.vel) * dt;
            m.x -= ux * sp;
            m.y -= uy * sp;
            if (m.critter) m.moving = true;
          }
          m.ang = Math.atan2(-uy, -ux); // olha para você
          dd = Math.hypot(m.x - d.px, m.y - d.py) || 1;
          if (dd > B.len) {
            // você correu mais que ele: a corda puxa ele (não segura você)
            m.x = d.px + ux * B.len;
            m.y = d.py + uy * B.len;
          }
        }
      } else {
        m.ko = Math.max(m.ko || 0, 1.5);
        m.st = "recover"; // caído; se a corda estica, vem arrastado
        if (folOn(m)) {
          B.caiT = (B.caiT ?? LACO.caido) - dt;
          if (B.caiT <= 0) {
            // levanta domado (sem fôlego, o bicho da cena inicial, fica caído como antes)
            B.fase = "domado";
            m.ko = 0;
            m.folRes = DOMA.inicio; // o interno recomeça baixo e sobe até o pinote (DOMA)
            m.fol = Math.max(m.fol!, Math.min(folCap(m), LACO.levanta * m.folMax!));
            spawnDungeonToast("🐺 Domado: vem andando · G puxa", m.x, m.y - 40, "#ffe08a", 12);
            loboLevantou(m); // v7.7 — campanha: levantou na corda = o lobo do Caçador domado
          }
        }
        if (dd > B.len) {
          const ex = dd - B.len,
            k = Math.min(0.6, LACO.arrasto * monStr(m));
          d.px += ux * ex * k;
          d.py += uy * ex * k;
          m.x -= ux * ex * (1 - k);
          m.y -= uy * ex * (1 - k);
        }
      }
    } else {
      const th = performance.now() / 1000,
        monP = monStr(m) * (0.35 + (folOn(m) ? folPct(m) : m.hp / m.hpMax)),
        heroP = 0.55 + h.attrs.forca * 0.025 + profLv(h, "domador") * 0.05;
      m.st = "recover";
      m.t = 0.3;
      m.parry = null;
      if (folOn(m)) m.folT = Math.min(m.folT!, 1); // brigando com a corda não recupera fôlego
      B.wa = Math.max(-1.3, Math.min(1.3, (B.wa || 0) + (Math.random() - 0.5) * dt * 5));
      const fa = Math.atan2(uy, ux) + B.wa,
        sp = LACO.forca * monP;
      m.x += Math.cos(fa) * sp * dt + Math.sin(th * 23 + m.x) * 0.7;
      m.y += Math.sin(fa) * sp * dt + Math.cos(th * 19 + m.y) * 0.7;
      m._yaw = Math.atan2(uy, ux) + Math.sin(th * 15) * 0.45;
      m.ang = Math.atan2(uy, ux);
      if (m.critter) m.moving = true;
      if (B.deb == null) B.deb = LACO.debate[0] + Math.random() * (LACO.debate[1] - LACO.debate[0]);
      B.deb -= dt;
      if (B.deb <= 0) {
        B.deb = LACO.debate[0] + Math.random() * (LACO.debate[1] - LACO.debate[0]);
        m.x += ux * 14 * monP;
        m.y += uy * 14 * monP;
        cansarHeroi(LACO.tranco * monP * plateMult(h)); // v7.7: o tranco puxa o seu fôlego
        shakeScreen(0.06, 2);
        spawnDungeonToast("💢", m.x, m.y - 34, "#ffb37a", 13);
      }
      /* v7.7 — cabo de guerra: os dois cansam por segundo (primeiro o interno, depois o de fora) */
      cansarBicho(m, (LACO.cansaBicho * (heroP / 0.7) * dt) / Math.sqrt(monStr(m)));
      cansarHeroi(LACO.cansaHeroi * monP * plateMult(h) * dt);
      ax = m.x - d.px;
      ay = m.y - d.py;
      dd = Math.hypot(ax, ay) || 1;
      ux = ax / dd;
      uy = ay / dd;
      if (dd > B.len) {
        const ex = dd - B.len,
          k = Math.max(0.15, Math.min(0.7, monP / (monP + heroP)));
        d.px += ux * ex * k;
        d.py += uy * ex * k;
        m.x -= ux * ex * (1 - k);
        m.y -= uy * ex * (1 - k);
      }
      if (d.gstam != null && d.gstam <= 0) {
        // v7.7: quem zera o fôlego primeiro perde — você zerou, a corda escapa
        ropeRelease(m, true);
        if (m.critter) m.scared = 5;
        if (Math.random() < 0.35) ropeWear(h, 2);
        spawnDungeonToast("Soltou-se da corda!", m.x, m.y - 34, "#ff9a7a", 14);
        sfx("guardbreak");
        continue;
      }
    }
    m.x = Math.max(T, Math.min(d.cols * T - T, m.x));
    m.y = Math.max(T, Math.min(d.rows * T - T, m.y));
    d.px = Math.max(T, Math.min(d.cols * T - T, d.px));
    d.py = Math.max(T, Math.min(d.rows * T - T, d.py));
  }
}
export function knifeMode() {
  const d = dungeon,
    h = d.hero;
  if (!h || !d.active || d.weapon !== "melee" || d.spearOut || !knifeActive(h)) return false;
  const e = ensureEquip(h);
  return !e.maoD || KNIFE_KEYS.includes(e.maoD.def.key);
}
export function knifeSlash() {
  const d = dungeon;
  if (d.dead || d.invOpen || d.craftOpen || d.modalOpen || d.guard || d.cd! > 0 || d.parryVis! > 0 || d.finish) return;
  const h = d.hero!,
    T = d.tile;
  let ang = aimAngle();
  if (!isFinite(ang)) ang = 0;
  const step = (d.comboT! > 0 ? d.combo || 0 : 0) % 2;
  d.cd = FACA2.cd * atkSpeedMult();
  d.cdMax = d.cd;
  reveal();
  sfx("swing");
  d.combo = step + 1;
  d.comboT = COMBO_WINDOW;
  d.px = Math.max(T, Math.min(d.cols * T - T, d.px + Math.cos(ang) * 3));
  d.py = Math.max(T, Math.min(d.rows * T - T, d.py + Math.sin(ang) * 3));
  d.slash = { ang, life: 0.16, step, half: FACA2.half, reach: FACA2.reach, ox: d.px, oy: d.py, knife: true };
  const inCone = [];
  for (const m of d.monsters) {
    if (!m.alive) continue;
    const B = wolfBody(m),
      q = bodyDist(B, d.px, d.py),
      dx = q.x - d.px,
      dy = q.y - d.py,
      dist = Math.hypot(dx, dy);
    if (dist - B.r > T * FACA2.reach) continue;
    if (dist > B.r && angDiff(Math.atan2(dy, dx), ang) > FACA2.half + Math.asin(Math.min(1, B.r / dist))) continue;
    inCone.push({ m, dist });
  }
  if (!inCone.length) {
    gainSkill(h, "faca", 0.1);
    return;
  }
  inCone.sort((a, b) => a.dist - b.dist);
  const first = inCone[0].m,
    mk = d.target && d.target !== first && inCone.some((o) => o.m === d.target) ? d.target : null;
  withBagKnife(() => {
    const base = meleeDmg(h) * FACA2.mult * (step === 1 ? FACA2.segundo : 1),
      os = DMG.src;
    DMG.src = "kcorte";
    try {
      d.fx!.push({ x: first.x, y: first.y, life: 0.2 });
      hurtMonster(first, base, "faca", 2);
      if (mk && mk.alive) {
        d.fx!.push({ x: mk.x, y: mk.y, life: 0.15 });
        hurtMonster(mk, base * FACA2.marcado, "faca", 1);
      }
    } finally {
      DMG.src = os;
    }
  });
}
/* dano em área: junta os acertos do golpe e aplica dividido pela quantidade de alvos */
export function areaWrap(fn: (this: unknown, ...a: never[]) => unknown): (...args: Repasse[]) => Repasse {
  return function (this: unknown) {
    if (AREA.q) return fn.apply(this, arguments as Repasse);
    AREA.q = [];
    let r;
    try {
      r = fn.apply(this, arguments as Repasse);
    } finally {
      const q = AREA.q;
      AREA.q = null;
      const n = new Set(q.map((x) => x[0])).size,
        k = AREA.k(n);
      for (const [m, dmg, s, xp, src, key] of q) {
        if (!m.alive) continue;
        const os = DMG.src,
          ok = DMG.key;
        DMG.src = src;
        DMG.key = key;
        try {
          hurtMonster(m, dmg * k, s, xp);
        } finally {
          DMG.src = os;
          DMG.key = ok;
        }
      }
      if (n >= 2) {
        const d = dungeon;
        spawnDungeonToast("⚔ ×" + n + " (" + Math.round(k * 100) + "%)", d.px, d.py - 44, "#e8d6a8", 10);
      }
    }
    return r;
  };
}
