/* ==== Fase 4 ====
   efeitos do dano em 3 tipos: fôlego, projéteis e armas cravadas, arremesso (v6.2, v6.9, v7.4) */
import { mundoMover } from "../map/mundo.ts";
import { reservaInimigo } from "./folego.ts";
import { monProf, ensureFol, DMG, isMonstro, folCap, plateMult, folPct, folTeto } from "./dano.ts";
import { DANO, KNIFE_KEYS, WPN_OF, CRAV2, ARREMESSO, FINAL, EXAUSTAO } from "../data/combate.ts";
import { dungeon, GL3, TELAS } from "../core/state.ts";
import { wolfBody, hurtMonster, meleeDmg, wolfStrike } from "./acertos.ts";
import { D3 } from "./projecao.ts";
import { finishTarget, knifeActive, monStr } from "./faca_corda.ts";
import { MOB } from "../ui/celular.ts";
import { ISC } from "../intro/cena.ts";
import { CRIT } from "./campo_vida.ts";
import { CRIT_SP } from "../data/campo.ts";
import { spawnDungeonToast } from "./masmorra.ts";
import { addRing, sfx, knockApart, shakeScreen } from "./chao.ts";
import { wpnKey, wpnProf } from "./armas.ts";
import { applyStun, applyBleed } from "./combate.ts";
import { eqWeaponMult } from "../items/durabilidade.ts";
import { gainSkill } from "../hero/nivel.ts";
import { profWeapon } from "../hero/proficiencias.ts";
import type { CravadoNoBicho, Cravando, Dungeon, Flecha, LancaCampo, Monster } from "../core/tipos.ts";

/* ---------- projéteis cravados: pagam em pulsos de 1 s ---------- */
function cravChance(m: Monster, mix: number[]) {
  const res = monProf(m).res;
  return Math.min(0.95, (mix[0] * 1.3) / 100) * (1 - Math.min(DANO.TETO, res[0]) / 100);
}

/* ---------- arma cravada no corpo a corpo: empurrar (segurar) / arrancar (tocar) ---------- */
export function cravFam(key: string) {
  const f = typeof KNIFE_KEYS !== "undefined" && KNIFE_KEYS.includes(key) ? "faca" : WPN_OF[key];
  const P = DANO.CRAVAR[f];
  return P && P.pago === "arranque" ? f : null;
}
function cravL(C: Cravando) {
  const T = dungeon.tile,
    r = wolfBody(C.m).r;
  // A profundidade desloca a arma, sem aproximar os corpos.
  return Math.max(r * 0.55 + T * 0.45, T * (CRAV2.ponta[C.f] || 0.8) + r * 0.55);
}
/* a arma só solta quando a stamina de um dos dois zera (jogador → cravFail · bicho → KO paga o guardado) */
/* v7.7 — jog: aproximação escolhida na roda do mouse (1 = o padrão afastado · ZOOM_JOG.max = a distância antiga) */
export const ZOOM_JOG = { max: 1.2, passo: 0.05 };
/* v7.7 — voo: a câmera desce ao entrar e sobe ao sair do campo pelo zoom (map/transicao.ts). `voo` anima o fator de
   `de` até `ate` em `ms`; `saida` (0..1, com o instante `saidaT`) é o quanto a roda já juntou para sair: a câmera
   sobe um pouco antes (até SUBIDA_SAIDA), como prévia. */
interface Voo {
  de: number;
  ate: number;
  t0: number;
  ms: number;
}
export const CZ = {
  f: 1,
  pose: false,
  jog: 1,
  voo: null as Voo | null,
  saida: 0,
  saidaT: 0,
  /* v8.0 — de perto: passando do zoom máximo, a roda leva a câmera até o personagem e dá a volta até ficar de frente
     para ele (0 = a vista de sempre, 1 = de frente, perto). `pertoAlvo` é o da roda, `perto` anda até ele; `pertoYaw`
     = para onde o herói olhava ao começar (a câmera não gira com a mira). Andar desfaz. */
  perto: 0,
  pertoAlvo: 0,
  pertoYaw: 0,
  pertoPx: 0,
  pertoPy: 0,
  inv: false, // a mochila estava aberta ao lado (zoom máximo) no quadro anterior
  /** deslocamento horizontal do personagem na tela de perto (fração da largura, + = para a direita): com a mochila
   *  aberta ele fica no espaço livre ao lado do painel */
  desloc: 0,
};
/** Começa (ou continua) a vista de perto até `alvo` (0..1): guarda para onde o herói olhava e onde estava. */
export function pertoComecar(alvo: number) {
  const d = dungeon;
  if (CZ.pertoAlvo === 0) {
    CZ.pertoYaw = GL3.hyaw ?? Math.PI / 2;
    CZ.pertoPx = d.px;
    CZ.pertoPy = d.py;
  }
  CZ.pertoAlvo = Math.max(CZ.pertoAlvo, Math.min(1, alvo));
}
/** A vista de perto (renderer.ts vpPerto): distância, altura (graus) e campo de visão do começo (0) e do fim (1), a
 *  altura do ponto olhado no herói (o peito) e a velocidade com que `perto` segue a roda. */
export const ZOOM_PERTO = {
  passo: 0.2,
  vel: 5,
  dist: [560, 150],
  alt: [47, 14],
  fov: [0.45, 0.6],
  alvoY: [8, 28],
  semContorno: 0.25, // a partir daqui, sem o contorno de tela (de perto ele vira uma auréola grossa)
  andar: 2.5, // quanto o herói anda (unidades) para a vista de perto se desfazer
  desloc: 0.56, // com a mochila ao lado: a personagem anda esta fração da meia-largura da tela para a esquerda
};
const SUBIDA_SAIDA = 0.3; // quanto a câmera sobe com a roda juntando para sair (0,3 = 30% mais longe no fim)
function fatorVoo() {
  const v = CZ.voo;
  if (!v) return 1;
  // t0 = 0: começa no segundo quadro do campo (o primeiro monta a cena e pode levar mais de um segundo); -1 = viu o 1º
  if (v.t0 <= 0) {
    v.t0 = v.t0 === 0 ? -1 : performance.now();
    if (v.t0 < 0) return v.de;
  }
  const t = Math.min(1, (performance.now() - v.t0) / v.ms),
    e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  if (t >= 1 && v.ate === 1) CZ.voo = null;
  return v.de + (v.ate - v.de) * e;
}
export function cravPose() {
  const d = dungeon,
    C = d.crav;
  if (C && C.m && D3.gl) {
    const a = Math.atan2(C.m.y - d.py, C.m.x - d.px),
      sh = C.jolt! > 0 ? Math.sin(performance.now() / 25) * 0.12 : 0;
    if (!GL3.atk || !GL3.atk.crav) GL3.atk = { step: 2, t: 0.2, ang: a, hit: true, crav: true };
    GL3.atk.ang = a + sh;
    GL3.fz = C.hold ? 0.2 : 0.19;
    GL3.hyaw = a + sh;
    CZ.pose = true;
  } else if (CZ.pose) {
    CZ.pose = false;
    GL3.fz = null;
    if (GL3.atk && GL3.atk.crav) GL3.atk = null;
  }
}
export function cravZoom(dt: number) {
  const d = dungeon;
  if (!D3.on || !D3.gl || !d.active) {
    CZ.f = 1;
    CZ.perto = CZ.pertoAlvo = 0;
    return;
  }
  // v8.0: no zoom máximo a mochila abre ao lado (mantenedor: "no zoom máximo ela poderia mover um pouco para a
  // esquerda e à direita aparecer a mochila"): o painel fica à direita, sem escurecer a cena, e a personagem vai para
  // a esquerda da tela (CZ.desloc, renderer.ts vpPerto). Fechar a mochila (X, I) tira o painel; afastar a roda também.
  const lado = !!d.invOpen && CZ.pertoAlvo >= 1;
  if (lado !== CZ.inv) {
    CZ.inv = lado;
    document.getElementById("inv-modal")?.classList.toggle("lateral", lado);
  }
  CZ.desloc += ((lado ? ZOOM_PERTO.desloc : 0) - CZ.desloc) * Math.min(1, dt * ZOOM_PERTO.vel);
  // de perto: andar (ou a arma cravada, o golpe final) desfaz; `perto` segue a roda com suavidade
  if (CZ.pertoAlvo > 0 && (d.crav || d.finish || Math.hypot(d.px - CZ.pertoPx, d.py - CZ.pertoPy) > ZOOM_PERTO.andar))
    CZ.pertoAlvo = 0;
  CZ.perto += (CZ.pertoAlvo - CZ.perto) * Math.min(1, dt * ZOOM_PERTO.vel);
  if (CZ.perto < 0.002 && CZ.pertoAlvo === 0) CZ.perto = 0;
  document.getElementById("dungeon-stage-wrap")?.classList.toggle("perto", CZ.perto > 0.12);
  const voando = !!CZ.voo,
    saida = performance.now() - CZ.saidaT < 1200 ? CZ.saida : 0,
    want =
      (d.crav ? (d.crav.hold ? CRAV2.zoom : CRAV2.zoomCrav) : 1) *
      (d.finish ? FINAL.zoom : 1) *
      CZ.jog *
      fatorVoo() *
      (1 - SUBIDA_SAIDA * Math.min(1, saida)),
    // no voo a câmera segue a curva da transição sem atraso
    nf = voando ? want : CZ.f + (want - CZ.f) * Math.min(1, dt * CRAV2.zoomVel);
  if (Math.abs(nf - CZ.f) < 1e-4) return;
  D3.s *= nf / CZ.f;
  d.k = D3.s * (D3.dpr || 1);
  CZ.f = nf;
}
/* ==== v7.7 — fôlego em círculo, igual para o jogador e os bichos ====
   Anel de fora = fôlego externo. Círculo de dentro = reserva interna: cai por quebra externa e pelo
   cabo de guerra do laço, sem limitar a recuperação externa de combate; no chão, o círculo de
   dentro vira o tempo até levantar. Jogador: d.gint (ver FOL_HEROI). Pequeno e discreto; cresce no laço e com a arma
   cravada. O bicho só mostra o dele quando está marcado, laçado ou com a arma cravada. */
const FOL_ANEL = {
  r: 5.5, // raio normal
  rGrande: 8, // no laço / arma cravada
  bicho: "#6ec8ff",
  bichoDentro: "rgba(191,232,255,.62)",
  bichoCaido: "#bfe8ff",
  heroiDentro: "rgba(255,236,170,.62)",
  baixo: "#ff8a4a", // anel abaixo de 25%
};
/** O anel: fundo, trilho, arco do fôlego (p) e o círculo de dentro (dentro, 0..1) em pizza. */
function anelFolego(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  p: number,
  dentro: number,
  cor: string,
  corDentro: string,
  alfa = 1,
  pulso = 1,
) {
  const k = r / FOL_ANEL.r;
  c.save();
  c.globalAlpha = alfa;
  c.beginPath();
  c.fillStyle = "rgba(14,16,20,.88)";
  c.arc(x, y, r + 2 * k, 0, 7);
  c.fill();
  c.lineWidth = 1;
  c.strokeStyle = "rgba(255,255,255,.14)";
  c.stroke();
  c.lineCap = "round";
  c.lineWidth = 1.9 * k;
  c.beginPath();
  c.strokeStyle = "rgba(255,255,255,.09)";
  c.arc(x, y, r, 0, 7);
  c.stroke();
  if (p > 0.005) {
    c.beginPath();
    c.strokeStyle = cor;
    c.globalAlpha = alfa * pulso;
    c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.min(1, p) * 6.2832);
    c.stroke();
    c.globalAlpha = alfa;
  }
  const ri = r * 0.55;
  c.beginPath();
  c.fillStyle = "rgba(255,255,255,.08)";
  c.arc(x, y, ri, 0, 7);
  c.fill();
  if (dentro > 0.005) {
    c.beginPath();
    c.moveTo(x, y);
    c.fillStyle = corDentro;
    c.arc(x, y, ri, -Math.PI / 2, -Math.PI / 2 + Math.min(1, dentro) * 6.2832);
    c.closePath();
    c.fill();
  }
  c.restore();
}
/** Algum bicho brigando na corda (cabo de guerra)? */
function naCorda(d: Dungeon) {
  return d.monsters.some((m) => m.alive && m.bound && !m.bound.dom);
}
/** v8.1 — onde fica o anel de fôlego da heroína (o centro e o raio): os estados (field/estados.ts) usam o mesmo lugar. */
export function anelHeroi(d: Dungeon) {
  const r = !!d.crav || naCorda(d) ? FOL_ANEL.rGrande : FOL_ANEL.r;
  // Na cravada, o anel fica do lado oposto à lâmina para não escondê-la.
  const lado = d.crav && d.crav.m.x >= d.px ? -1 : 1;
  return { x: d.px + lado * (r + 9), y: d.py - r - 7, r };
}
/* stamina do jogador em círculo ao lado do personagem (o raio do meio virou o fôlego interno) */
export function stamRing(c: CanvasRenderingContext2D, d: Dungeon) {
  const grande = !!d.crav || naCorda(d),
    gi = d.gint == null ? 100 : d.gint,
    show =
      grande ||
      d.gstam! < 99.5 ||
      gi < 99.5 ||
      d.guard ||
      d.guardBroken! > 0 ||
      d.running ||
      (d.charging && d.charge! >= 1); // v8.0: arco cheio gasta o interno
  d._stA = (d._stA || 0) + ((show ? 1 : 0) - (d._stA || 0)) * 0.2;
  if (d._stA < 0.03) return;
  const { x, y, r } = anelHeroi(d),
    p = Math.max(0, Math.min(1, (d.gstam == null ? 100 : d.gstam) / 100)),
    corFaixa = gi > 75 ? "#55d878" : gi > 50 ? "#a5d85b" : gi > 25 ? "#ffd23a" : "#ff5148",
    col = d.guardBroken! > 0 ? "#ff6b6b" : d.running ? corFaixa : "#397a49",
    colDentro = corFaixa,
    pul = grande && p < 0.25 ? 0.6 + 0.4 * Math.sin(performance.now() / 90) : 1;
  anelFolego(c, x, y, r, p, gi / 100, col, colDentro, d._stA, pul);
}
export function folAnelVisivel(m: Monster) {
  const d = dungeon;
  return folOn(m) && (d.target === m || !!m.bound || (!!d.crav && d.crav.m === m));
}
/** Raio do anel do bicho (maior na corda). */
export function folAnelRaio(m: Monster) {
  return m.bound && !m.bound.dom ? FOL_ANEL.rGrande : FOL_ANEL.r;
}
/** Anel do bicho em (x, y) — quem chama já sabe onde fica o bicho na tela (2D, chão do 3D ou billboard). */
export function folAnel(c: CanvasRenderingContext2D, m: Monster, x: number, y: number) {
  const A = FOL_ANEL,
    p = Math.max(0, Math.min(1, folPct(m))),
    caido = m.ko! > 0,
    dentro = caido ? Math.max(0, Math.min(1, m.ko! / (m.koMax || m.ko!))) : folTeto(m);
  anelFolego(c, x, y, folAnelRaio(m), p, dentro, p < 0.25 ? A.baixo : A.bicho, caido ? A.bichoCaido : A.bichoDentro);
}
/** v7.7 — velocidade do bicho pela faixa de fôlego (DANO.FOLEGO.vel); 1 para quem não tem fôlego. */
export function folVel(m: Monster) {
  if (!folOn(m)) return 1;
  if (m.fugaFolego! > 0) return EXAUSTAO.fuga.velocidade;
  if (m.exaustoFolego) return EXAUSTAO.velocidade[3];
  if (m.desespero! > 0 && (m.critter || m.neutral)) return DANO.FOLEGO.desespero.vel; // v8.1: a fuga desesperada
  const p = folPct(m),
    V = DANO.FOLEGO.vel;
  const reserva = reservaInimigo(m),
    desgaste = EXAUSTAO.velocidade[reserva > 0.5 ? 0 : reserva > 0.25 ? 1 : reserva > 0 ? 2 : 3];
  // Primeira quebra resistida: continua lutando normalmente, mesmo com a barra externa vazia.
  if (m.quebrasFolego === 1) return desgaste;
  return m.quebrasFolego != null ? desgaste : V[p >= 0.75 ? 0 : p >= 0.5 ? 1 : p >= 0.25 ? 2 : 3];
}
export function cravChanceMelee(m: Monster, mix: number[], key: string) {
  const f = cravFam(key),
    P = f && DANO.CRAVAR[f];
  if (P && P.chance != null) return P.chance * (1 - Math.min(DANO.TETO, monProf(m).res[0]) / 100);
  return cravChance(m, mix);
}
function arremessoNivel(ch: number) {
  return ch >= 0.999 ? 2 : ch >= ARREMESSO.medio ? 1 : 0;
}
/* marcador de finalizar: anel tracejado com 🔪 no bicho (o texto foi para o aviso único do E) */
export function finMark(c: CanvasRenderingContext2D, m: Monster, t: number) {
  c.save();
  c.strokeStyle = "rgba(255,224,138," + (0.55 + 0.35 * Math.sin(t * 6)) + ")";
  c.lineWidth = 2;
  c.setLineDash([4, 4]);
  c.lineDashOffset = -t * 20;
  const r = Math.max(14, wolfBody(m).r + 6);
  c.beginPath();
  c.ellipse(m.x, m.y, r, r * 0.6, 0, 0, 6.283);
  c.stroke();
  c.setLineDash([]);
  c.fillStyle = "rgba(30,20,8,.85)";
  c.beginPath();
  c.arc(m.x + r * 0.8, m.y - r * 0.7, 8, 0, 6.283);
  c.fill();
  c.font = "10px serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("🔪", m.x + r * 0.8, m.y - r * 0.7 + 0.5);
  c.restore();
}
export function finPrompt() {
  const d = dungeon;
  if (d.finish || d.dead) return null;
  const m = finishTarget();
  if (!m) return null;
  return (typeof MOB !== "undefined" && MOB.on ? "✋ " : "[E] ") + "🔪 Finalizar " + (m.name || "").toLowerCase();
}

/* ---------- fôlego ---------- */
export function folOn(m: Monster) {
  return !!(
    m &&
    m.alive &&
    !m.dummy &&
    m.kind !== "bird" &&
    !(m.intro && typeof ISC !== "undefined" && ISC.on) &&
    ensureFol(m).folMax! > 0
  );
}
/** v8.0 — cansa o bicho numa fração do fôlego dele (parry e esquiva perfeitos: PARRY.cansaBicho, ESQUIVA.cansaBicho). */
export function folCansar(m: Monster, frac: number) {
  if (folOn(m)) folDrain(m, m.folMax! * frac);
}
export function folDrain(m: Monster, n: number) {
  /* v7.0 */
  {
    const S = m && m.critter && CRIT.cur === m && CRIT_SP[m.sp!];
    if (S && S.folHitMax && n > 0) {
      ensureFol(m);
      n = Math.min(n, S.folHitMax * m.folMax!);
    }
  }
  if (!(n > 0) || !folOn(m) || m.ko! > 0) return;
  const antes = m.fol!;
  m.fol = Math.max(0, antes - n);
  m.folLost! += n;
  m.folT = 0;
  if (antes > 0 && m.fol <= 0) {
    // Salvas antigas conservam o desgaste que já tinham pelas quedas.
    m.quebrasFolego = (m.quebrasFolego ?? m.quedas ?? 0) + 1;
    const reserva = reservaInimigo(m),
      etapa = Math.min(3, Math.max(0, Math.ceil((1 - reserva) / EXAUSTAO.perdaInterna) - 1));
    if (reserva <= 0) m.exaustoFolego = true;
    if (m.fugaFolego! > 0) return;
    // Quebra sem queda: a próxima barra já vem cheia (mantenedor, 2026-11-06: cada quebra custa o mesmo esforço).
    if (m.protecaoFolego! > 0) m.fol = folCap(m);
    else if (Math.random() < EXAUSTAO.chanceQueda[etapa]) folKO(m);
    else if (reserva > 0) m.fol = folCap(m);
    else {
      m.fugaFolego = EXAUSTAO.fuga.duracao;
      m.st = "flee";
      m.humanoGuardT = 0;
      m.humanoInvuln = 0;
      m.humanoEsquivaT = 0;
      m.parry = null;
      if (dungeon.crav?.m === m) cravEnd("fuga");
      spawnDungeonToast("💨 Fuga desesperada!", m.x, m.y - 40, "#bfe8ff", 13);
    }
  }
}
function folKO(m: Monster) {
  const F = DANO.FOLEGO;
  m.fol = 0;
  m.fugaFolego = 0;
  desesperoFim(m);
  m.humanoGuardT = 0;
  m.humanoInvuln = 0;
  m.humanoEsquivaT = 0;
  m.ko = m.boss ? F.koBoss : F.koT;
  m.koMax = m.ko; // v7.7: o círculo de dentro conta o tempo no chão
  m.quedas = (m.quedas || 0) + 1; // estatística; a reserva cai por quebra, não por queda
  m.downT = Math.max(m.downT || 0, m.ko);
  m.st = "recover";
  m.t = 0.3;
  m.parry = null;
  // v8.1: cada queda abre a ferida de cada arma ainda cravada (DANO.CRAVAR[k].sangraQueda, 1 por segundo: stickTick)
  let abriu = false;
  for (const s of m.stk || []) {
    const q = DANO.CRAVAR[s.k] && DANO.CRAVAR[s.k].sangraQueda;
    if (q) {
      s.sangra = (s.sangra || 0) + q;
      abriu = true;
    }
  }
  if (abriu) spawnDungeonToast("🩸", m.x + 10, m.y - 30, "#ff6a6a", 15);
  if (dungeon.crav && dungeon.crav.m === m) cravEnd("ko");
  spawnDungeonToast("😮‍💨 Caiu!", m.x, m.y - 36, "#9fe3ff", 14);
  addRing(m.x, m.y, "#9fe3ff", 36, 0.4, 3);
  sfx("perfect");
  if (!DMG._koTip) {
    DMG._koTip = 1;
    setTimeout(() => {
      try {
        if (dungeon.active)
          spawnDungeonToast(
            (typeof MOB !== "undefined" && MOB.on ? "🔪" : "E") + " = abate limpo",
            dungeon.px,
            dungeon.py - 56,
            "#ffe08a",
            12,
          );
      } catch (_) {}
    }, 700);
  }
}

/* ---------- sangramento leve (corte): 1/s por 5 s, não acumula, só renova ---------- */
/* ---------- golpe direto: resistências + efeitos de cada tipo ---------- */
export function dmgKeyFor(skill: string) {
  const d = dungeon,
    h = d.hero!;
  if (DMG.key) return DMG.key;
  if (skill === "arco") return "flecha";
  if (skill === "faca") {
    const k = knifeActive(h);
    return k ? k.def.key : "eq_faca";
  }
  const k = wpnKey(h);
  if (k) return k;
  if (d.spearOut) return "eq_lanca";
  return "punho";
}
export function danoEfeitos(
  m: Monster,
  r: { parts: number[]; total: number },
  mix: number[],
  key: string,
  _skill: string,
) {
  if (!m.alive || m.dummy) return;
  const [p, c, i] = r.parts,
    res = monProf(m).res,
    src = DMG.src,
    intro = m.intro && typeof ISC !== "undefined" && ISC.on;
  /* impacto: empurra, interrompe a preparação e pode atordoar (com imunidade depois); v8.0: só armas de impacto de
     verdade (DANO.IMPACTO.minEfeito) */
  if (i > 0.05 && mix[2] >= DANO.IMPACTO.minEfeito) {
    const I = DANO.IMPACTO,
      kb = Math.min(30, i * I.empurra);
    if (kb > 3 && !m.bound && !m.crav) knockApart(m, kb, 0);
    if (m.st === "windup" || m.st === "bwind") {
      m.st = "recover";
      m.t = 0.55;
      m.parry = null;
      spawnDungeonToast("Interrompido!", m.x, m.y - 30, "#9fe3ff", 12);
    }
    const heavy = src === "heavy" && mix[2] > 60;
    if (
      !intro &&
      !(m.stunImm! > 0) &&
      !(m.ko! > 0) &&
      (heavy || Math.random() < (mix[2] / 100) * I.chance * Math.min(1, i / 3))
    ) {
      const t = Math.min(I.tMax, I.tMin + i * 0.2);
      applyStun(m, t);
      m.stunImm = t + I.imune;
      spawnDungeonToast("💫", m.x, m.y - 30, "#ffe08a", 18);
    }
  }
  /* corte: sangramento leve (não acumula, renova) */
  if (c > 0.05 && Math.random() < (mix[1] / 100) * DANO.CORTE.chance * (1 - Math.min(DANO.TETO, res[1]) / 100)) {
    const had = !!m.bleed;
    applyBleed(m, c * DANO.CORTE.frac); // v8.0: proporcional à parte cortante do golpe
    if (!had) spawnDungeonToast("🩸", m.x + 8, m.y - 30, "#ff6a6a", 15);
  }
  /* todo golpe cansa: em golpes o bicho desmaia depois de perder ~60% da vida (impacto cansa mais) */
  if (!intro && folOn(m) && !(m.ko! > 0)) {
    const F = DANO.FOLEGO;
    folDrain(m, ((r.total * F.golpe + i * F.impacto * F.golpe) * m.folMax!) / Math.max(1, m.hpMax));
  }
  /* perfurante: arma corpo a corpo pode cravar (impacto não crava) */
  if (
    (src === "swing" || src === "stab") &&
    p > 0.05 &&
    mix[0] > mix[2] &&
    cravFam(key) &&
    cravPode(m) &&
    Math.random() < cravChanceMelee(m, mix, key)
  )
    cravStart(m, key);
}
function cravPode(m: Monster) {
  const d = dungeon;
  return (
    !d.crav &&
    !d.finish &&
    m.alive &&
    !m.dummy &&
    !(m.ko! > 0) &&
    !m.bound &&
    !(m.cravCd! > 0) &&
    !(m.intro && typeof ISC !== "undefined" && ISC.on) &&
    !d.camp
  );
}
export function cravStart(m: Monster, key: string) {
  const d = dungeon,
    f = cravFam(key)!,
    P = DANO.CRAVAR[f],
    mon = isMonstro(m);
  ensureFol(m);
  d.crav = {
    m,
    key,
    f,
    P,
    t: 0,
    max: P.tempoMax! * (mon ? 0.5 : 1),
    stored: P.inicial!,
    hold: false,
    h0: 0,
    dep: 0.02,
    pt: CRAV2.pulso,
    mon,
    skill: f === "faca" ? "faca" : "espada",
  };
  m.crav = true;
  d.guard = false;
  d.charging = false;
  d.combo = 0;
  d.comboT = 0;
  if (!mon) {
    m.st = "recover";
    m.t = 0.3;
    m.parry = null;
  }
  spawnDungeonToast("🗡 Cravou!", m.x, m.y - 44, "#ffcf8a", 13);
  sfx("hit");
  shakeScreen(0.08, 2);
}
function cravPay(C: Cravando, amt: number, folToo: boolean) {
  const d = dungeon,
    m = C.m;
  if (!m.alive || !(amt > 0)) return;
  const o = DMG.key,
    os = DMG.src;
  DMG.key = C.key;
  DMG.src = "rip";
  try {
    hurtMonster(m, amt * eqWeaponMult(d.hero!), C.skill, 3);
  } finally {
    DMG.key = o;
    DMG.src = os;
  }
  if (folToo) folDrain(m, C.stored * DANO.FOLEGO.arranque);
}
function cravEnd(kind: string | null) {
  const d = dungeon,
    C = d.crav;
  if (!C) return;
  d.crav = null;
  const m = C.m;
  m.crav = false;
  m.cravCd = 3;
  if (kind === "ko" || kind === "fuga") cravPay(C, C.stored, false);
  if (kind === "fuga") spawnDungeonToast("A arma soltou na marra", m.x, m.y - 34, "#ffb37a", 12);
}

export function folWake(m: Monster) {
  if (!folOn(m)) return;
  m.fol = Math.max(1, folCap(m) * DANO.FOLEGO.levanta);
  m.folT = 0;
  m.protecaoFolego = EXAUSTAO.protecaoLevantar;
  if (!m.exaustoFolego) desesperoIni(m);
}
/** v8.1 — levantou de uma queda: o susto (FOLEGO.desespero). O fôlego sobe a pelo menos `folego` do máximo, mesmo
    acima do teto, e não se recupera enquanto dura: a presa e o bicho neutro fogem mais rápido (folVel) gastando esse
    fôlego (critAI) e caem de novo se não escaparem; o predador bravo fica feroz: mais dano (dm) e o frenesi do lobo
    (field/combate.ts: ataca mais vezes, mais rápido e prepara o bote em menos tempo). Na corda não vale (o laço manda). */
function desesperoIni(m: Monster) {
  if (m.bound || m.dummy) return;
  const D = DANO.FOLEGO.desespero;
  m.desespero = D.t;
  m.fol = Math.max(m.fol!, m.folMax! * D.folego);
  if (m.critter || m.neutral) {
    spawnDungeonToast("💨 Fuga desesperada!", m.x, m.y - 40, "#bfe8ff", 13);
    return;
  }
  if (m.feroz == null) {
    m.feroz = m.dm ?? 1;
    m.dm = m.feroz * D.dm;
  }
  if (!m.humano) spawnDungeonToast("😡 Fúria!", m.x, m.y - 40, "#ff7a5a", 14); // v8.1: no humano, sem texto (mantenedor)
  addRing(m.x, m.y, "#ff7a5a", 34, 0.35, 3);
}
function desesperoFim(m: Monster) {
  m.desespero = 0;
  if (m.feroz == null) return;
  m.dm = m.feroz;
  m.feroz = undefined;
}
export function folTick(m: Monster, dt: number) {
  if (!folOn(m)) return;
  if (m.protecaoFolego! > 0) m.protecaoFolego = Math.max(0, m.protecaoFolego! - dt);
  if (m.fugaFolego! > 0) {
    m.fugaFolego = Math.max(0, m.fugaFolego! - dt);
    if (m.fugaFolego === 0) folKO(m);
  }
  if (m.cravCd! > 0) m.cravCd! -= dt;
  if (m.stunImm! > 0) m.stunImm! -= dt;
  if (m.desespero! > 0) {
    m.desespero! -= dt;
    if (m.desespero! <= 0 || m.bound) desesperoFim(m);
  }
  if (m.ko! > 0) {
    // v8.0: caído, o fôlego volta aos poucos até o que ele levanta com (FOLEGO.levanta): dá para ver ele se recuperar
    const alvo = folCap(m) * DANO.FOLEGO.levanta;
    if (m.fol! < alvo) m.fol = Math.min(alvo, m.fol! + (alvo / Math.max(0.5, m.koMax || m.ko!)) * dt);
    return;
  }
  m.folT! += dt;
  if (m.desespero! > 0) return; // v8.1: o fôlego do susto passa do teto e não se recupera: só gasta
  const cap = folCap(m);
  if (m.fol! > cap) m.fol = cap;
  else if (m.folT! > DANO.FOLEGO.espera) m.fol = Math.min(cap, m.fol! + DANO.FOLEGO.regen * dt);
}
/** Último esforço: afasta-se com colisão, sem atacar nem desaparecer pela IA de fuga do bando. */
export function folFugindo(m: Monster, dt: number) {
  if (!(m.fugaFolego! > 0) || m.bound || m.ko! > 0) return false;
  const d = dungeon,
    a = Math.atan2(m.y - d.py, m.x - d.px),
    base = m.critter ? (CRIT_SP[m.sp!]?.flee ?? 38) : (m.spd || 38) * 1.75,
    passo = base * EXAUSTAO.fuga.velocidade * dt,
    T = d.tile;
  [m.x, m.y] = mundoMover(
    m.x,
    m.y,
    Math.max(T, Math.min(d.cols * T - T, m.x + Math.cos(a) * passo)),
    Math.max(T, Math.min(d.rows * T - T, m.y + Math.sin(a) * passo)),
    0.3,
  );
  m.ang = a;
  m.st = "flee";
  m.moving = true;
  m.humanoCorrendo = true;
  return true;
}
function stickAdd(m: Monster, kind: string, vida: number, ang: number, cheia = false) {
  const P = DANO.CRAVAR[kind],
    // v8.0: fração do fôlego do bicho (flecha), ou o valor fixo antigo
    fol = P.folFrac != null && folOn(m) ? m.folMax! * (cheia ? P.folFracCheia! : P.folFrac) : P.folego!;
  m.stk = m.stk || [];
  const lim = P.max || 4;
  while (m.stk.filter((s: CravadoNoBicho) => s.k === kind).length >= lim)
    m.stk.splice(
      m.stk.findIndex((s: CravadoNoBicho) => s.k === kind),
      1,
    );
  m.stk.push({
    k: kind,
    n: P.dur!,
    t: 1,
    vida: vida / P.dur!,
    fol: fol / P.dur!,
    a: (ang || 0) - (m.ang || 0) + (Math.random() - 0.5) * 0.6,
  });
}
export function arrowStick(m: Monster, a: Flecha, vida: number) {
  if (!m || !m.alive) return;
  const mix = DANO.ARMAS.flecha;
  if (m.dummy || Math.random() >= cravChance(m, mix)) {
    folDrain(m, 1);
    return;
  }
  stickAdd(m, "flecha", Math.max(1, vida || DANO.CRAVAR.flecha.vida!), Math.atan2(a.vy, a.vx), !!a.full);
}
export function stickTick(m: Monster, dt: number) {
  if (!m.stk || !m.stk.length) return;
  for (let i = m.stk.length - 1; i >= 0; i--) {
    const s = m.stk[i];
    s.t -= dt;
    if (s.t > 0) continue;
    s.t = 1;
    s.n--;
    const sangue = s.sangra! > 0 ? 1 : 0; // v8.1: a ferida aberta pela queda (folKO)
    if (sangue) s.sangra!--;
    if (s.vida + sangue > 0) hurtMonster(m, s.vida + sangue, "arco", 0, true);
    if (!m.alive) {
      m.stk = [];
      return;
    }
    folDrain(m, s.fol);
    if (s.n > 0) continue;
    // v8.1: a que fica cravada (DANO.CRAVAR[k].fica) segue tirando fôlego até o bicho morrer; as outras saem
    const fica = DANO.CRAVAR[s.k] && DANO.CRAVAR[s.k].fica;
    if (fica) {
      s.n = Infinity;
      s.vida = 0;
      s.fol = fica;
    } else m.stk.splice(i, 1);
  }
}
export function cravPress() {
  // reescrita na v6.9
  const C = dungeon.crav;
  if (!C || C.hold) return;
  C.hold = true;
  C.h0 = performance.now();
  C.sndT = CRAV2.somSeg;
  sfx("block");
  shakeScreen(0.05, 1.5);
}
export function cravRelease() {
  // reescrita na v6.9
  const C = dungeon.crav;
  if (!C || !C.hold) return;
  C.hold = false;
}
export function cravRip() {
  const d = dungeon,
    C = d.crav;
  if (!C) return;
  const h = d.hero!,
    m = C.m,
    W = wpnProf(h),
    base = (meleeDmg(h) * (W.mult || 1) * 0.8) / Math.max(0.3, eqWeaponMult(h));
  spawnDungeonToast("Arrancou!", m.x, m.y - 40, "#ffcf8a", 13);
  cravPay(C, base + C.stored, true);
  d.fx!.push({ x: m.x, y: m.y, life: 0.3 });
  addRing(m.x, m.y, "#ff8a5a", 30, 0.3, 3);
  shakeScreen(0.12, 3);
  sfx("hit");
  if (d.crav === C) cravEnd(null);
  d.cd = 0.35;
  d.cdMax = 0.35;
  gainSkill(h, C.f === "faca" ? "faca" : profWeapon(h), 2);
}
function cravFail(why: string) {
  const d = dungeon,
    C = d.crav;
  if (!C) return;
  const m = C.m;
  d.crav = null;
  m.crav = false;
  m.cravCd = 3;
  d.guard = false;
  spawnDungeonToast(why, d.px, d.py - 46, "#ff9a7a", 12);
  sfx("guardbreak");
  if (m.alive && !(m.ko! > 0)) {
    wolfStrike(m, null, m.boss ? 6 : m.kind === "javalino" ? 5 : 3.5, 0);
    knockApart(m, 14, 26);
  }
  d.noAtk = 1.5;
}
export function cravTick(dt: number) {
  // reescrita na v6.9
  const d = dungeon,
    C = d.crav;
  if (!C) return;
  const m = C.m,
    h = d.hero!,
    T = d.tile;
  if (!d.active || d.dead || !m.alive || d.camp) {
    d.crav = null;
    m.crav = false;
    return;
  }
  C.t += dt;
  const F = DANO.FOLEGO,
    R = CRAV2;
  C.dep = Math.min(R.fundo, (C.dep || 0.02) + (C.hold ? (dt * R.fundo) / 2 : 0));
  if (C.jab! > 0) C.jab! -= dt; // a ponta entra no corpo enquanto segura
  if (d.gstam != null) d.gregen = Math.max(d.gregen || 0, 0.35); // cravado: a stamina não volta
  if (C.hold) {
    // Cada segundo de pressão: 1 de vida e 2 de fôlego do animal.
    C.pt = (C.pt ?? R.pulso) - dt;
    while (C.pt <= 0) {
      C.pt += R.pulso;
      C.jab = 0.14;
      const vidaAntes = m.hp;
      hurtMonster(m, 1, C.skill, 1, true);
      if (m.alive) folDrain(m, Math.min(1, Math.max(0, vidaAntes - m.hp)) * F.empurrar);
      d.fx!.push({ x: m.x, y: m.y, life: 0.18 });
      addRing(m.x, m.y, "#c0302a", 14, 0.25, 2);
      if (!m.alive || !d.crav) {
        if (d.crav) cravEnd(null);
        return;
      }
    }
    if (d.gstam != null) d.gstam = Math.max(0, d.gstam - F.stamina * dt * monStr(m) * plateMult(h));
    C.sndT = (C.sndT || 0) - dt;
    if (C.sndT <= 0) {
      C.sndT = R.somSeg;
      sfx("hitlite");
    }
  }
  /* o bicho se debate e acerta a stamina */
  if (C.deb == null) C.deb = R.debate[0] + Math.random() * (R.debate[1] - R.debate[0]);
  C.deb -= dt;
  if (C.deb <= 0 && !(m.ko! > 0)) {
    C.deb = R.debate[0] + Math.random() * (R.debate[1] - R.debate[0]);
    const hit = Math.round(R.debateStam * monStr(m) * (0.5 + folPct(m)) * (C.hold ? 0.8 : 1) * plateMult(h));
    if (d.gstam != null) d.gstam = Math.max(0, d.gstam - hit);
    C.jolt = 0.28;
    shakeScreen(0.1, 3);
    sfx("melee");
    spawnDungeonToast("💢 -" + hit + "⚡", d.px, d.py - 40, "#ffb37a", 11);
  }
  if (d.gstam != null && d.gstam <= 0) {
    cravFail("Sem stamina — a arma soltou");
    return;
  }
  const th = performance.now() / 1000,
    L = cravL(C);
  let ax = m.x - d.px,
    ay = m.y - d.py,
    dd = Math.hypot(ax, ay) || 1,
    ux = ax / dd,
    uy = ay / dd;
  if (!C.mon && !(m.ko! > 0)) {
    // tenta fugir para longe, mudando de rumo
    C.wa = Math.max(-1.2, Math.min(1.2, (C.wa || 0) + (Math.random() - 0.5) * dt * 5));
    const fa = Math.atan2(uy, ux) + C.wa,
      sp = R.foge * (0.35 + folPct(m)) * monStr(m) * (C.hold ? 0.45 : 1);
    m.x += Math.cos(fa) * sp * dt;
    m.y += Math.sin(fa) * sp * dt;
    if (C.jolt! > 0) {
      C.jolt! -= dt;
      m.x += Math.sin(th * 41) * 2.2;
      m.y += Math.cos(th * 37) * 2.2;
    }
    m._yaw = Math.atan2(-uy, -ux) + Math.sin(th * 15) * (C.jolt! > 0 ? 0.7 : 0.3);
  }
  /* a ponta está presa: se a distância passa da arma, um puxa o outro */
  ax = m.x - d.px;
  ay = m.y - d.py;
  dd = Math.hypot(ax, ay) || 1;
  ux = ax / dd;
  uy = ay / dd;
  if (dd > L) {
    const ex = dd - L,
      k = C.mon ? 0.5 : C.hold ? R.puxaHold : R.puxa;
    d.px += ux * ex * k;
    d.py += uy * ex * k;
    m.x -= ux * ex * (1 - k);
    m.y -= uy * ex * (1 - k);
  } else if (dd < L * 0.85) {
    m.x = d.px + ux * L * 0.85;
    m.y = d.py + uy * L * 0.85;
  }
  m.x = Math.max(T, Math.min(d.cols * T - T, m.x));
  m.y = Math.max(T, Math.min(d.rows * T - T, m.y));
  d.px = Math.max(T, Math.min(d.cols * T - T, d.px));
  d.py = Math.max(T, Math.min(d.rows * T - T, d.py));
}

/* ---------- laço: a barra da corda vira o fôlego (segurar G cansa o bicho) ---------- */
/* arma cravada: lâmina, barra do guardado e fôlego do bicho (armasDraw2D chama) */
export function cravDraw2D() {
  const d = dungeon,
    C = d.crav,
    c = TELAS.dCtx;
  if (!d.active || !C) return;
  const m = C.m,
    t = performance.now() / 1000,
    k = C.stored / C.P.teto!;
  c.save();
  if (!D3.gl) {
    c.strokeStyle = C.hold ? "#ffcf8a" : "#d8d2c4";
    c.lineWidth = C.hold ? 3.4 : 2.4;
    c.beginPath();
    c.moveTo(d.px, d.py - 4);
    c.lineTo(m.x + Math.sin(t * 30) * (C.hold ? 1.5 : 0.6), m.y - 4);
    c.stroke();
  } else {
    const a = Math.atan2(m.y - d.py, m.x - d.px),
      tl = cravL(C) - wolfBody(m).r * 0.25,
      tx = d.px + Math.cos(a) * tl,
      ty = d.py + Math.sin(a) * tl;
    c.fillStyle = "rgba(150,20,20," + (C.hold ? 0.85 : 0.6) + ")";
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.arc(tx + Math.sin(t * 7 + i * 2) * 3, ty + Math.cos(t * 5 + i) * 2, 1.6 + (C.hold ? 0.8 : 0), 0, 7);
      c.fill();
    }
  }
  const bw = 46,
    bx = m.x - bw / 2,
    by = m.y - 60;
  c.fillStyle = "rgba(0,0,0,.65)";
  c.fillRect(bx, by, bw, 6);
  c.fillStyle = "#ff9a4a";
  c.fillRect(bx, by, bw * k, 6);
  // v8.1: o arquinho azul do fôlego do bicho saiu daqui: o anel dele (folAnel) já aparece ao lado (mantenedor
  // 2026-10-31: "quando a arma tá cravada aparece outra barrinha de stamina?")
  c.font = "600 10px Lora,serif";
  c.textAlign = "center";
  c.fillStyle = "#fff1c2";
  c.fillText(
    "🗡 " +
      Math.round(C.stored) +
      (C.hold ? " 💪" : MOB.on ? " · segure ⚔ empurra · 🛡 arranca" : " · segure: empurra · direito: arranca"),
    m.x,
    by - 4,
  );
  c.restore();
}

/* ---------- lança arremessada: crava pela ponta (perfurante) e cansa o bicho; depois cai no chão ---------- */
export function spearThrowStick(m: Monster, crit: boolean, s: LancaCampo) {
  // reescrita na v7.4
  if (!m || !m.alive || m.dummy) return false;
  const lv = arremessoNivel(s && s.ch != null ? s.ch : 1);
  return Math.random() < ARREMESSO.chance[lv] * (1 - Math.min(DANO.TETO, monProf(m).res[0]) / 100);
}
export function spearStuckTick(s: LancaCampo, m: Monster, dt: number) {
  const P = DANO.CRAVAR.lanca_arremesso;
  s.bt! += dt;
  s.st = (s.st || 0) + dt;
  if (s.bt! >= 1) {
    s.bt = 0;
    hurtMonster(m, P.vida! / P.dur!, "arco", 0, true);
    if (m.alive) folDrain(m, P.folego! / P.dur!);
  }
  return s.st >= P.dur!;
}
