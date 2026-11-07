/* ==== v8.1 — bandidos no campo: a luta contra humanos refeita (mantenedor 2026-10-31) ====
   No lugar da IA do parceiro de treino (humanoTactics em acertos.ts, que fica para a sala de treino por enquanto):
   · cada tipo tem a própria ficha (data/bandidos.ts), sem copiar a força nem a velocidade da heroína;
   · o golpe tem preparo que dá para ver (anel, a arma subindo) e ele acompanha você devagar: sair de lado esquiva, e o
     parry vale no fim do preparo (wolfStrike/parryNaChegada, como no lobo); o pesado quebra o escudo levantado;
   · ele só reage ao que vê: você mirando nele (anda de lado e fica pronto para rolar da flecha), o golpe pesado sendo
     carregado perto (recua); demora `reacao` s para reagir. O golpe rápido ele não lê: quem tem escudo levanta a
     guarda por conta própria, de frente (pelas costas não vale);
   · no bando, no máximo BANDO.atacantes atacam de perto por vez; os outros rodeiam puxando para as suas costas;
   · fôlego como o dos bichos (o mesmo anel): golpe, esquiva e bloqueio cansam; sem fôlego cai, e caído dá para
     finalizar (E) ou poupar (R): entrega algo de valor, só foge, ou ataca na sujeira;
   · o último de pé foge abaixo de BANDO.fogeVida da vida; com BANDO.ateMorte ou menos, luta até a morte. ==== */
import { defesaFolego } from "./folego.ts";
import { dungeon, econ } from "../core/state.ts";
import { BANDIDOS, BANDO } from "../data/bandidos.ts";
import { ITEM_DEFS } from "../data/itens.ts";
import { aimAngle, wolfStrike } from "./acertos.ts";
import { spawnDungeonToast } from "./masmorra.ts";
import { sfx, shakeScreen } from "./chao.ts";
import { folCansar, folVel } from "./tipos.ts";
import { DMG, folPct } from "./dano.ts";
import { applyStun } from "./combate.ts";
import { mundoMover, barrado } from "../map/mundo.ts";
import { angDiff } from "../core/util.ts";
import { pushEvent } from "../sim/eventos.ts";
import { addHeroXp } from "../hero/nivel.ts";
import type { Monster } from "../core/tipos.ts";

const B_ = { grupo: 0 };
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const ficha = (m: Monster) => BANDIDOS[m.bandido!] ?? BANDIDOS.capuz;

/** Quem do bando `g` ainda luta (vivo, não fugindo). */
function bandoAtivo(g: number) {
  return dungeon.monsters.filter((o) => o.alive && o.bandido && o.grupo === g && !o.bFoge);
}
/** Ainda há bandido vivo do bando `g` (lutando ou fugindo): a luta acabou quando não. */
export function bandoNoCampo(g: number) {
  return dungeon.monsters.some((o) => o.alive && o.bandido && o.grupo === g && !o.bFoge);
}

/** Sorteia os tipos de um bando de `n` (o arqueiro, no máximo um). */
function sortearTipos(n: number) {
  const pesos = Object.entries(BANDO.sorteio),
    total = pesos.reduce((s, [, p]) => s + p, 0),
    tipos: string[] = [];
  if (n > 1 && Math.random() < BANDO.arqueiro) tipos.push("arqueiro");
  while (tipos.length < n) {
    let r = Math.random() * total;
    for (const [k, p] of pesos)
      if ((r -= p) <= 0) {
        tipos.push(k);
        break;
      }
  }
  return tipos;
}

/** Um bando de `n` chegando de `dist` tiles na direção `ang` (rad, a partir da heroína). Devolve o número do bando. */
export function bandoChega(n: number, ang: number, dist: number) {
  const d = dungeon,
    T = d.tile,
    g = ++B_.grupo;
  sortearTipos(n).forEach((tipo, i) => {
    let x = d.px,
      y = d.py;
    for (let k = 0; k < 30; k++) {
      const a = ang + (i - (n - 1) / 2) * 0.32 + rnd(-0.12, 0.12),
        r = (dist + rnd(-1, 1) + (k > 15 ? -3 : 0)) * T;
      x = Math.max(T * 1.5, Math.min(d.cols * T - T * 1.5, d.px + Math.cos(a) * r));
      y = Math.max(T * 1.5, Math.min(d.rows * T - T * 1.5, d.py + Math.sin(a) * r));
      if (!d.origem || !barrado(x, y, T * 0.3)) break;
    }
    novoBandido(tipo, x, y, g);
  });
  return g;
}

function novoBandido(tipo: string, x: number, y: number, g: number) {
  const B = BANDIDOS[tipo],
    m: Monster = {
      name: B.nome,
      x,
      y,
      target: null,
      hp: B.hp,
      hpMax: B.hp,
      alive: true,
      st: "chase",
      t: 0,
      dm: 1,
      spd: B.vel,
      ang: Math.atan2(dungeon.py - y, dungeon.px - x),
      atk: "jab",
      pcd: rnd(0.6, 1.4),
      kind: "humano",
      humano: true,
      humanoCC: false, // o "Preso" a cada golpe travava a heroína no meio do bando; o que derruba é o pesado do bruto
      humanoLado: Math.random() < 0.5 ? 1 : -1,
      bandido: tipo,
      grupo: g,
      prof: B.prof,
      bEspera: rnd(1.6, 3.2),
      bPasso: 1,
      alerted: true,
      lowSet: true, // a vida baixa não vira frenesi/fuga aleatória: a fuga do bando é a regra de cima
    };
  dungeon.monsters.push(m);
  return m;
}

/* ---------- a IA (updateDungeonMonster → humanos com `bandido`) ---------- */
export function bandidoAI(m: Monster, dt: number) {
  const d = dungeon,
    T = d.tile,
    B = ficha(m),
    dx = d.px - m.x,
    dy = d.py - m.y,
    dist = Math.hypot(dx, dy) || 1,
    a = Math.atan2(dy, dx);
  m.moving = false;
  m.humanoCorrendo = false;
  m.humanoFolego = folPct(m) * 100; // o painel do alvo mostra o fôlego dele
  for (const k of ["humanoInvuln", "humanoGuardT", "bStrafe", "bGuardaCd", "stun", "slow"] as const)
    m[k] = Math.max(0, (m[k] || 0) - dt);
  if (m.humanoGolpeT != null && (m.humanoGolpeT += dt) > 0.5) m.humanoGolpeT = undefined;
  if (m.humanoSoltarT != null && (m.humanoSoltarT -= dt) <= 0) m.humanoSoltarT = undefined;
  if (m.humanoAtingidoT != null && (m.humanoAtingidoT += dt) >= 0.45) m.humanoAtingidoT = undefined;
  if (m.humanoBloqueouT != null && (m.humanoBloqueouT += dt) >= 0.5) m.humanoBloqueouT = undefined;
  if (!m.bVez) m.bEspera = (m.bEspera || 0) + dt;

  if (m.bFoge) return fugir(m, dt, dist);
  moral(m);
  if (m.bFoge) return;
  if ((m.stun || 0) > 0) {
    m.st = "recover";
    m.t = Math.max(m.t || 0, m.stun!);
    soltarVez(m);
    return;
  }
  if ((m.humanoEsquivaT || 0) > 0) {
    m.humanoEsquivaT = Math.max(0, m.humanoEsquivaT! - dt);
    if (m.humanoEsquivaT <= 0) m.humanoRolando = false;
    andar(m, m.humanoEsquivaX || 0, m.humanoEsquivaY || 0, B.vel * 3.4 * dt);
    return;
  }
  if (m.st === "windup") return preparo(m, dt, dist, a);
  if (m.st === "recover") {
    m.t -= dt;
    if (m.t <= 0) m.st = "chase";
    return;
  }
  m.pcd = Math.max(0, (m.pcd || 0) - dt);
  if (reagir(m, dt, dist, a)) return;
  if ((m.humanoGuardT || 0) > 0) {
    // guarda levantada: de frente para você, parado; larga para atacar quando chega a hora
    m.ang = a;
    if (!(m.bVez && m.pcd! <= 0 && dist <= B.alcance * T)) return;
    m.humanoGuardT = 0;
  }
  pegarVez(m);
  // guarda por conta própria: perto, sem estar atacando, com fôlego
  if (
    B.escudo &&
    B.guarda > 0 &&
    !(m.bGuardaCd! > 0) &&
    dist < (B.alcance + 1.1) * T &&
    folPct(m) > 0.35 &&
    Math.random() < dt * B.guarda * 1.6 * defesaFolego(m)
  ) {
    m.humanoGuardT = rnd(...BANDO.guardaDur);
    m.bGuardaCd = BANDO.guardaCd + m.humanoGuardT;
    m.st = "chase";
    return;
  }
  if (B.arco) return arqueiro(m, dt, dist, a);
  if (m.bVez) {
    if (dist <= B.alcance * T * 0.95 && m.pcd! <= 0) return atacar(m, a);
    // v8.2: de meia distância às vezes avança já golpeando
    const I = BANDO.investida;
    if (m.pcd! <= 0 && dist >= I.de * T && dist <= I.ate * T && Math.random() < dt * I.chance) {
      atacar(m, a);
      m.bInvest = I.t;
      return;
    }
    const lat = dist < 2.4 * T ? 0.3 * (m.humanoLado || 1) : 0,
      ux = dx / dist,
      uy = dy / dist,
      longe = dist > BANDO.corre * T; // v8.2: de longe vem correndo
    m.ang = a;
    m.humanoCorrendo = longe;
    if (dist > B.alcance * T * 0.8)
      andar(m, ux - uy * lat, uy + ux * lat, B.vel * dt * (longe ? BANDO.correVel : 1.15));
    return;
  }
  rodear(m, dt, dist, a);
}

/** O último de pé: abaixo de fogeVida foge; com ateMorte ou menos, luta até a morte (mais forte e mais rápido). */
function moral(m: Monster) {
  if (m.bAteMorte || bandoAtivo(m.grupo!).length !== 1) return;
  const v = m.hp / m.hpMax;
  if (v <= BANDO.ateMorte) {
    m.bAteMorte = true;
    m.dm = (m.dm || 1) * BANDO.ateMorteDano;
  } else if (v < BANDO.fogeVida) comecarFuga(m, "💨 Fugiu!");
}
function comecarFuga(m: Monster, txt: string) {
  m.bFoge = true;
  soltarVez(m);
  m.st = "chase";
  m.humanoGuardT = 0;
  if (dungeon.target === m) dungeon.target = null;
  spawnDungeonToast(txt, m.x, m.y - 38, "#bfe8ff", 13);
}
function fugir(m: Monster, dt: number, dist: number) {
  const d = dungeon;
  if (m.ko! > 0) return;
  if (dist > BANDO.some * d.tile) {
    m.alive = false;
    m.fugiu = true;
    return;
  }
  const ux = (m.x - d.px) / dist,
    uy = (m.y - d.py) / dist;
  m.ang = Math.atan2(uy, ux);
  m.humanoCorrendo = true;
  andar(m, ux, uy, ficha(m).vel * BANDO.fugaVel * dt);
}

function andar(m: Monster, vx: number, vy: number, passo: number) {
  const d = dungeon,
    T = d.tile,
    n = Math.hypot(vx, vy);
  if (n < 1e-4) return;
  const k = passo * (m.slow! > 0 ? 0.5 : 1) * folVel(m),
    x0 = m.x,
    y0 = m.y,
    x1 = Math.max(T, Math.min(d.cols * T - T, x0 + (vx / n) * k)),
    y1 = Math.max(T, Math.min(d.rows * T - T, y0 + (vy / n) * k));
  [m.x, m.y] = mundoMover(x0, y0, x1, y1, 0.3);
  m.moving = Math.hypot(m.x - x0, m.y - y0) > 0.05;
}

/* ---------- a vez de atacar ---------- */
function pegarVez(m: Monster) {
  if (m.bVez || ficha(m).arco) return;
  // v8.2: você golpeando no vazio ou rolando perto dele: aproveita, mesmo sem a vez
  const d = dungeon;
  if (((d.cd || 0) > 0.12 || !!d.dodge) && Math.hypot(d.px - m.x, d.py - m.y) < BANDO.punir * d.tile && !(m.ko! > 0)) {
    m.bVez = true;
    m.pcd = 0;
    return;
  }
  if ((m.bEspera || 0) < BANDO.vez) return;
  const bando = bandoAtivo(m.grupo!).filter((o) => !ficha(o).arco && !(o.ko! > 0));
  if (bando.filter((o) => o.bVez).length >= BANDO.atacantes) return;
  // a vez vai para quem espera há mais tempo
  if (bando.some((o) => o !== m && !o.bVez && (o.bEspera || 0) > (m.bEspera || 0) && (o.bEspera || 0) >= BANDO.vez))
    return;
  m.bVez = true;
}
function soltarVez(m: Monster) {
  if (m.bVez) m.bEspera = 0;
  m.bVez = false;
}

/** Sem a vez: rodeia a BANDO.rodeio tiles, puxando para as costas dela, sem se amontoar. */
function rodear(m: Monster, dt: number, dist: number, a: number) {
  const d = dungeon,
    T = d.tile,
    B = ficha(m),
    fi = Math.atan2(m.y - d.py, m.x - d.px), // onde ele está, visto dela
    costas = aimAngle() + Math.PI,
    falta = Math.atan2(Math.sin(costas - fi), Math.cos(costas - fi)),
    lado = Math.abs(falta) > 0.25 ? Math.sign(falta) : m.humanoLado || 1,
    tx = -Math.sin(fi) * lado,
    ty = Math.cos(fi) * lado,
    rad = Math.max(-1, Math.min(1, (BANDO.rodeio * T - dist) / T)), // + afasta, − aproxima
    ux = Math.cos(fi),
    uy = Math.sin(fi);
  let sx = 0,
    sy = 0;
  for (const o of d.monsters) {
    if (o === m || !o.alive) continue;
    const ox = m.x - o.x,
      oy = m.y - o.y,
      dd = Math.hypot(ox, oy);
    if (dd < T * 1.1 && dd > 0.1) {
      sx += ox / dd;
      sy += oy / dd;
    }
  }
  m.ang = a;
  const k = Math.abs(falta) > 0.25 ? BANDO.costas : 0.25;
  andar(m, tx * k + ux * rad * 1.2 + sx * 0.8, ty * k + uy * rad * 1.2 + sy * 0.8, B.vel * 0.8 * dt);
}

/* ---------- ver e reagir ---------- */
/** A ameaça que ele vê agora: você mirando nele, o golpe pesado sendo carregado perto, uma flecha vindo nele. */
function ameaca(m: Monster, dist: number) {
  const d = dungeon,
    T = d.tile;
  for (const f of d.arrows || []) {
    const v = Math.hypot(f.vx, f.vy) || 1,
      rx = m.x - f.x,
      ry = m.y - f.y,
      ao = (rx * f.vx + ry * f.vy) / v,
      perp = Math.abs(rx * f.vy - ry * f.vx) / v;
    if (ao > 0 && ao < T * 3.5 && perp < T * 0.7) return "flecha";
  }
  if (((d.weapon === "bow" && d.charging) || d.spCh) && dist < T * 10) {
    if (angDiff(aimAngle(), Math.atan2(m.y - d.py, m.x - d.px)) < 0.3) return "mira";
  }
  if (d.hv && dist < (ficha(m).alcance + 1.4) * T) return "pesado";
  return null;
}
/** Reage ao que viu, depois do tempo de reação. Devolve true se gastou o quadro reagindo. */
function reagir(m: Monster, dt: number, dist: number, a: number) {
  const B = ficha(m),
    k = ameaca(m, dist);
  if (!k) {
    if (m.bViu && m.bViu.k !== "mira") m.bViu = null;
    else if (m.bViu && m.bViu.t >= 0) m.bViu.t = -1e-4; // parou de mirar: o "pronto" dura mais um pouco
  } else if (m.bViu && m.bViu.k === k && m.bViu.t < 0)
    m.bViu.t = m.bViu.reag; // voltou a mirar
  else if (!m.bViu || m.bViu.k !== k) {
    // a flecha só dá para esquivar se ele já via você mirando (pronto); a de surpresa chega antes de ele reagir
    const pronto = !!m.bViu && m.bViu.k === "mira" && m.bViu.feito;
    m.bViu = { k, t: 0, reag: k === "flecha" ? (pronto ? 0 : 9) : rnd(...B.reacao), feito: false };
  }
  const V = m.bViu;
  if (!V) return false;
  if (V.t < 0) {
    V.t -= dt;
    if (V.t < -1.2) m.bViu = null;
    return false;
  }
  V.t += dt;
  if (V.feito || V.t < V.reag) return false;
  V.feito = true;
  if (V.k === "mira") {
    if (!m.bVez || B.arco) m.bStrafe = 1.1; // sai da sua mira andando de lado
    return false;
  }
  if (V.k === "flecha" && Math.random() < B.esquiva * defesaFolego(m) && folPct(m) > 0.2) {
    esquivar(m, a, 0.15, true);
    return true;
  }
  if (V.k === "pesado" && Math.random() < (B.esquiva + 0.3) * defesaFolego(m) && folPct(m) > 0.2) {
    esquivar(m, a, -0.95, false); // recua para fora do alcance
    return true;
  }
  return false;
}
/** Passo rápido: `trasK` < 0 para trás, perto de 0 de lado. Com `rola`, invulnerável no começo (hurtMonsterBase). */
function esquivar(m: Monster, a: number, trasK: number, rola: boolean) {
  const lado = m.humanoLado || 1,
    ux = Math.cos(a),
    uy = Math.sin(a),
    vx = ux * trasK - uy * lado,
    vy = uy * trasK + ux * lado,
    n = Math.hypot(vx, vy) || 1;
  m.humanoEsquivaT = BANDO.esquivaDur;
  m.humanoEsquivaX = vx / n;
  m.humanoEsquivaY = vy / n;
  m.humanoRolando = rola;
  if (rola) m.humanoInvuln = BANDO.esquivaInvuln;
  m.humanoLado = -lado;
  m.humanoGuardT = 0;
  folCansar(m, BANDO.custo.esquiva);
}

/* ---------- golpes ---------- */
function atacar(m: Monster, a: number, sujo = false) {
  const B = ficha(m),
    pesado = !sujo && Math.random() < B.pesadoChance && folPct(m) > 0.4,
    P = pesado ? B.pesado : B.leve;
  m.st = "windup";
  m.atk = pesado ? "heavy" : "jab";
  m.bSujo = sujo;
  m.t = m.wuTot = (sujo ? BANDO.traiPreparo : P.preparo) * (m.bAteMorte ? 0.85 : 1);
  m.bPasso = pesado ? 2 : m.bPasso === 0 ? 1 : 0;
  m.ang = a;
  m.parry = null;
  m.humanoGolpeT = undefined;
  folCansar(m, pesado ? BANDO.custo.pesado : BANDO.custo.leve);
  // v8.1 (mantenedor): sem anel nem ⚠ — o golpe se lê no corpo: a arma sobe devagar e brilha no fim (bandidos_gl.ts);
  // o pesado também se ouve: ele puxa o ar
  if (pesado || sujo) sfx("folego");
}
function preparo(m: Monster, dt: number, dist: number, a: number) {
  const d = dungeon,
    T = d.tile,
    B = ficha(m),
    pesado = m.atk === "heavy";
  m.t -= dt;
  // v8.2: a investida — avança enquanto prepara
  if ((m.bInvest || 0) > 0) {
    m.bInvest! -= dt;
    andar(m, d.px - m.x, d.py - m.y, B.vel * BANDO.investida.vel * dt);
  }
  // acompanha você devagar (no arco, até a mira travar): sair de lado no fim do preparo esquiva
  if (!(B.arco && m.t <= BANDO.arcoTrava)) {
    const giro = (B.arco ? BANDO.giro.arco : pesado ? BANDO.giro.pesado : BANDO.giro.leve) * dt,
      df = Math.atan2(Math.sin(a - m.ang!), Math.cos(a - m.ang!));
    m.ang! += Math.max(-giro, Math.min(giro, df));
  }
  if (m.t > 0) return;
  const P = pesado ? B.pesado : B.leve,
    dano = P.dano * (m.bSujo ? BANDO.traiDano : 1);
  if (B.arco) atirar(m, dano);
  else {
    const alc = B.alcance * T * (pesado ? 1.12 : 1) + T * 0.25;
    if (dist <= alc && angDiff(a, m.ang!) < (pesado ? 1 : 0.85) && !d.dead) {
      const hp0 = d.hp;
      m.quebraGuarda = pesado;
      try {
        wolfStrike(m, null, dano, 0);
      } finally {
        m.quebraGuarda = false;
      }
      if (pesado && B.pesado.derruba && d.hp < hp0) {
        d.down = Math.max(d.down || 0, BANDO.derrubaT);
        spawnDungeonToast("Derrubada!", d.px, d.py - 48, "#ff806b", 15);
        shakeScreen(0.25, 5);
      }
    }
    sfx("swing");
  }
  m.humanoGolpeT = 0;
  // v8.2: o combo — emenda o próximo golpe leve logo; o último do combo deixa ele exposto mais tempo (a sua janela)
  const C = BANDO.combo;
  if (
    !B.arco &&
    !pesado &&
    !m.bSujo &&
    (m.bCombo || 0) + 1 < C.max &&
    Math.random() < C.chance &&
    dist <= B.alcance * T * 1.5 &&
    folPct(m) > 0.15
  ) {
    m.bCombo = (m.bCombo || 0) + 1;
    m.st = "windup";
    m.t = m.wuTot = C.preparo;
    m.bPasso = Math.min(2, m.bCombo);
    m.ang = a;
    folCansar(m, BANDO.custo.leve);
    sfx("swing");
    return;
  }
  const ultimo = (m.bCombo || 0) > 0;
  m.bCombo = 0;
  m.st = "recover";
  m.t = P.recupera * (ultimo ? C.ultimo : 1);
  m.pcd = m.t + rnd(0.1, 0.35);
  m.bSujo = false;
  m.humanoLado = -(m.humanoLado || 1);
  soltarVez(m);
}

/* ---------- o arqueiro: guarda distância e atira; a mira trava no fim (sair da linha esquiva) ---------- */
const TIROS: { x0: number; y0: number; x1: number; y1: number; t: number }[] = [];
function arqueiro(m: Monster, dt: number, dist: number, a: number) {
  const d = dungeon,
    T = d.tile,
    B = ficha(m),
    longe = B.alcance * T;
  m.ang = a;
  if (m.pcd! <= 0 && dist < longe * 0.95 && !(m.bStrafe! > 0)) {
    const pesado = Math.random() < B.pesadoChance,
      P = pesado ? B.pesado : B.leve;
    m.st = "windup";
    m.atk = pesado ? "heavy_arrow" : "arrow";
    m.t = m.wuTot = P.preparo;
    m.parry = null;
    folCansar(m, BANDO.custo.leve);
    return;
  }
  const ux = dx(m),
    uy = dy(m),
    lado = m.humanoLado || 1,
    rad = dist < longe * 0.6 ? -1 : dist > longe * 0.9 ? 1 : 0,
    lat = m.bStrafe! > 0 ? 1 : 0.35;
  andar(m, ux * rad - uy * lado * lat, uy * rad + ux * lado * lat, B.vel * dt * (rad < 0 ? 1.1 : 0.8));
}
const dx = (m: Monster) => (dungeon.px - m.x) / (Math.hypot(dungeon.px - m.x, dungeon.py - m.y) || 1);
const dy = (m: Monster) => (dungeon.py - m.y) / (Math.hypot(dungeon.px - m.x, dungeon.py - m.y) || 1);
function atirar(m: Monster, dano: number) {
  const d = dungeon,
    T = d.tile,
    B = ficha(m),
    ux = Math.cos(m.ang!),
    uy = Math.sin(m.ang!),
    rx = d.px - m.x,
    ry = d.py - m.y,
    ao = rx * ux + ry * uy,
    perp = Math.abs(rx * uy - ry * ux),
    alc = B.alcance * T * 1.15,
    acertou = ao > 0 && ao < alc && perp < BANDO.arcoLargura * T && !d.dead;
  if (acertou) wolfStrike(m, null, dano, 0);
  const L = acertou ? ao : alc;
  TIROS.push({ x0: m.x, y0: m.y, x1: m.x + ux * L, y1: m.y + uy * L, t: 0.18 });
  m.humanoSoltarT = 0.5;
  sfx("shoot");
}

/** O traço da flecha e a linha da mira do arqueiro, no chão (combatFx). */
export function bandidosDraw2D(c: CanvasRenderingContext2D, dt: number) {
  const d = dungeon,
    T = d.tile;
  // v8.1 (mantenedor): sem a linha da mira no chão — o arqueiro puxando a corda é o aviso
  for (const m of BANDO.linhaMira ? d.monsters : []) {
    if (!m.alive || !m.bandido || m.st !== "windup" || !ficha(m).arco) continue;
    const k = 1 - Math.max(0, m.t) / (m.wuTot || 1),
      trava = m.t <= BANDO.arcoTrava,
      L = ficha(m).alcance * T * 1.15;
    c.save();
    c.strokeStyle = trava ? "rgba(255,90,70,.85)" : "rgba(255,170,120," + (0.2 + 0.45 * k) + ")";
    c.lineWidth = trava ? 2.4 : 1.4;
    c.setLineDash(trava ? [] : [6, 6]);
    c.beginPath();
    c.moveTo(m.x, m.y);
    c.lineTo(m.x + Math.cos(m.ang!) * L, m.y + Math.sin(m.ang!) * L);
    c.stroke();
    c.restore();
  }
  for (let i = TIROS.length - 1; i >= 0; i--) {
    const s = TIROS[i];
    if ((s.t -= dt) <= 0) {
      TIROS.splice(i, 1);
      continue;
    }
    c.save();
    c.strokeStyle = "rgba(255,240,200," + s.t / 0.18 + ")";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(s.x0, s.y0);
    c.lineTo(s.x1, s.y1);
    c.stroke();
    c.restore();
  }
}

/* ---------- o escudo (hurtMonsterBase) ---------- */
/** Golpe direto no bandido de guarda levantada: de frente segura (devolve true, o dano cai); pelas costas não; o
    pesado (o golpe carregado) quebra a guarda. */
export function bandidoBloqueia(m: Monster) {
  const d = dungeon;
  if (angDiff(m.ang ?? 0, Math.atan2(d.py - m.y, d.px - m.x)) > 1.2) return false;
  if (DMG.src === "heavy") {
    m.humanoGuardT = 0;
    applyStun(m, 0.6);
    spawnDungeonToast("Guarda quebrada!", m.x, m.y - 34, "#ffd27a", 13);
    sfx("guardbreak");
    return false;
  }
  folCansar(m, BANDO.custo.bloqueio);
  m.humanoBloqueouT = 0;
  sfx("escudo"); // v8.1: o escudo segurou — no som e no corpo dele, sem texto
  return true;
}

/* ---------- caído: finalizar (E, faca_corda.ts) ou poupar (R) ---------- */
/** O bandido caído ao alcance de poupar (null se não há). */
export function bandidoPoupavel() {
  const d = dungeon;
  if (!d.active || d.camp || d.finish || d.dead) return null;
  let melhor: Monster | null = null,
    bd = d.tile * BANDO.pouparAlc;
  for (const m of d.monsters)
    if (m.alive && m.bandido && m.ko! > 0 && !m.bFoge) {
      const q = Math.hypot(m.x - d.px, m.y - d.py);
      if (q < bd) {
        bd = q;
        melhor = m;
      }
    }
  return melhor;
}
/** R perto de um bandido caído: entrega algo de valor e foge, só foge, ou ataca na sujeira. */
export function pouparBandido() {
  const m = bandidoPoupavel();
  if (!m) return false;
  const B = ficha(m),
    r = Math.random();
  m.ko = 0;
  m.downT = 0;
  m.bPoupado = true;
  if (r < B.trai) {
    // levanta já golpeando, rápido e forte
    spawnDungeonToast("🗡 Golpe sujo!", m.x, m.y - 40, "#ff7a5a", 15);
    m.bVez = true;
    atacar(m, Math.atan2(dungeon.py - m.y, dungeon.px - m.x), true);
    return true;
  }
  if (r < B.trai + (1 - B.trai) * BANDO.entrega) {
    const ouro = Math.round(rnd(...B.ouro) * 1.5);
    econ.gold += ouro;
    spawnDungeonToast("🙏 “Leva, leva!” · 💰 +" + ouro, m.x, m.y - 40, "#ffe08a", 14);
    if (Math.random() < 0.5) soltarArma(m);
    pushEvent(dungeon.hero!.name + " poupou um bandido, que entregou " + ouro + " de ouro.");
    comecarFuga(m, "💨");
  } else {
    comecarFuga(m, "💨 Fugiu correndo!");
    pushEvent(dungeon.hero!.name + " poupou um bandido, que fugiu.");
  }
  return true;
}

/* ---------- derrotado: o saque e o corpo ---------- */
export const CAIDOS: { m: Monster; ate: number; yaw: number }[] = [];
/** Chamado por hurtMonsterBase quando o bandido morre. */
export function bandidoCaiu(m: Monster) {
  const B = ficha(m),
    ouro = Math.round(rnd(...B.ouro));
  econ.gold += ouro;
  spawnDungeonToast("💰 +" + ouro, m.x, m.y - 22, "#ffe08a", 13);
  if (Math.random() < BANDO.armaChance) soltarArma(m);
  if (dungeon.hero) addHeroXp(dungeon.hero, BANDO.xp);
  CAIDOS.push({ m, ate: performance.now() + BANDO.corpo * 1000, yaw: m._yaw ?? m.ang ?? 0 });
  if (CAIDOS.length > 8) CAIDOS.shift();
}
function soltarArma(m: Monster) {
  const k = ficha(m).arma,
    d = dungeon;
  if (!ITEM_DEFS[k]) return;
  (d.loot ||= []).push({ key: k, tier: 0, t: 0, ttl: 0, x: m.x + rnd(-8, 8), y: m.y + rnd(-8, 8) });
}
