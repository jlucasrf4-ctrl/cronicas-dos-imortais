/* ==== v7.7 — campanha C2, passo 2 (docs/campanha.md): o cercado dos lobos no acampamento ====
   Um canto cercado com estacas e corda à direita do acampamento (acima da bigorna), com os lobos de econ.lobos
   andando dentro (o modelo animado do campo, render/gl/bichos.ts). A heroína entra pela porteira. Vínculo (0–4) sai de pontos
   (VINCULO.niveis): o Caçador alimenta todo dia (VINCULO.cacadorDia, por conta dele: o jogador não tem
   responsabilidade com o lobo dele) e dar carne da mochila (E no cercado, uma por lobo por dia) soma VINCULO.comida.
   Pouco vínculo: o lobo se afasta de quem chega perto; muito: vem até a cerca. As posições dos lobos não vão no save.
   Passo 4 (casalTick, de tempos em tempos): CASAL.segundoDias depois da captura o Caçador traz sozinho um lobo do
   sexo oposto (sem missão: um aviso); com o casal no vínculo 4 (e a costura feita) nasce o filhote (mais um em
   econ.lobos, `filhote`), e os pais têm CASAL.prazoDias para ir embora: E na cerca solta (rodeiam o acampamento e
   fogem, ou fogem já, conforme o vínculo); passado o prazo, o próprio Caçador solta.
   Passo 5a (FILHOTE): FILHOTE.soltoDias depois de os pais irem embora, o filhote pode estar solto pelo acampamento
   (sorteado a cada visita, FILHOTE.chance), brincando perto do Caçador; com FILHOTE.carneMin carnes na mochila ele
   sente o cheiro e vem atrás de você; perto dele o E dá a carne a ele.
   A porteira (PORTA, lado esquerdo): perto dela o E abre/fecha; a heroína entra e sai do cercado só por ela (a
   cerca bloqueia por dentro e por fora); aberta, lobo com vínculo abaixo de PORTA.fogeAbaixo corre para ela e foge
   (o do Caçador ele recupera em PORTA.voltaDias, econ.lobosFugidos); fecha sozinha a cada visita; os pais soltos
   saem por ela (abre sozinha por PORTA.auto s).
   v7.7 (mantenedor, 2026-10-20) — lobo com vínculo LIVRE.desde ou mais anda solto pelo acampamento (fora do
   cercado); com a heroína dentro do cercado ele entra pela porteira e a segue. E perto de um lobo abre o menu dele
   (MENU_LOBO): afagar (vínculo, uma vez por dia), dar comida (abre a mochila para escolher: COMIDA_LOBO), conduzir
   na coleira (COLEIRA: ele vem atrás pelo seu caminho; soltar a corda = fica solto, ou volta para o cercado com
   pouco vínculo) e soltar (os seus adultos; os pais do filhote). */
import { dungeon, econ, world, GL3 } from "../core/state.ts";
import { CONFIG } from "../core/config.ts";
import { CPS, campNear } from "../survival/acampamento.ts";
import { MB, mbBox, mbCyl, glMesh } from "../render/gl/malhas.ts";
import { M4 } from "../render/gl/geometria.ts";
import { glPush } from "../render/gl/renderer.ts";
import { bichoAnimado, tomPelagem } from "../render/gl/bichos.ts";
import { ensureInv } from "../items/inventario.ts";
import { qvInv } from "../expedicao/preparo.ts";
import { spawnDungeonToast, itemMsg } from "../field/masmorra.ts";
import { sfx, shakeScreen, toggleInv } from "../field/chao.ts";
import { campanha, campanhaEvento } from "./campanha.ts";
import { FALAS_CURTAS } from "../data/campanha.ts";
import { pushEvent } from "../sim/eventos.ts";
import { mvToast } from "../ui/avisos.ts";
import { ATLAS, drawSprite, fitSz } from "../render/sprites.ts";
import type { InvGrid, Item, LoboCercado } from "../core/tipos.ts";

/** Onde fica (em tiles, a partir da fogueira) e o tamanho (meia largura × meia altura, tiles). */
const CERCADO = { dx: 4, dy: -1.6, mw: 1.5, mh: 1.1, perto: 0.9, estaca: 0.75 };
/** Vínculo: pontos para chegar a cada nível (1..4), quanto o Caçador dá por dia e quanto cada dia sem comer da sua
    mão tira do seu lobo (o que a comida dá está em COMIDA_LOBO). */
const VINCULO = { niveis: [3, 8, 15, 25], cacadorDia: 1, descuidoDia: 1 };
/** Carnes que contam como "carne na mochila" (o cheiro para o filhote, o painel). */
const CARNES = ["carne", "carne_assada"];
/** v7.7 — o que o lobo come da sua mão (menu → Dar comida → escolher na mochila) e quantos pontos de vínculo dá. */
const COMIDA_LOBO: Record<string, number> = { carne: 1, carne_assada: 1, peixe: 1 };
/** v7.7 — lobo solto pelo acampamento: a partir de que vínculo, até onde ele passeia em volta do cercado (tiles),
    a que distância segue a heroína dentro do cercado, a velocidade. */
const LIVRE = { desde: 2, raioMin: 1.8, raio: 4.5, segue: 1.1, vel: 30, corre: 70 };
/** v7.7 — o menu do lobo: a que distância (tiles) dá para afagar e pôr a coleira, e quanto o afago dá por dia. */
const MENU_LOBO = { alcance: 1.6, afago: 1 };
/** v7.7 — na coleira: o comprimento da corda (tiles, pelo caminho da heroína) e a velocidade máxima dele. */
const COLEIRA = { dist: 1.1, vel: 110 };
/** Lobo no cercado: velocidade (mundo/s), distância que ele mantém de quem chega (tiles) por nível de vínculo. */
const LOBO_C = { vel: 34, velFoge: 60, medo: [2.6, 2, 0, 0, 0], vem: [0, 0, 0, 1, 1], escala: 0.95, filhote: 0.5 };
/** O casal e o filhote: dias até o Caçador trazer o 2º lobo, prazo para soltar os pais (dias), e os pais soltos:
    a partir de que vínculo rodeiam o acampamento antes de fugir, por quanto tempo (s), a que distância (tiles). */
const CASAL = { segundoDias: 3, prazoDias: 2, rodeiaDesde: 3, rodeiaS: 10, raio: 3.4, velFuga: 110 };

interface Bicho {
  L: LoboCercado;
  x: number;
  y: number;
  yaw: number;
  alvo: { x: number; y: number } | null;
  t: number;
  fora?: boolean; // v7.7: anda solto pelo acampamento (fora do cercado)
  rota?: { x: number; y: number }[]; // v7.7: passando pela porteira (entrando ou saindo)
  guiado?: boolean; // v7.7: na coleira, atrás da heroína
}
/** Um lobo que saiu do cercado: passa pela porteira (`rota`), rodeia o acampamento (`rodeia` s) e corre para fora
    pela esquerda. */
interface LoboSolto {
  x: number;
  y: number;
  yaw: number;
  pelagem: number;
  rodeia: number;
  ang: number;
  rota: { x: number; y: number }[];
  ataca?: boolean; // v7.7 (5b): pouco vínculo, vai até a heroína e morde uma vez antes de fugir
  escala?: number; // o tamanho dele (o filhote é pequeno também fugindo)
}
/** v7.7 (5b) — soltar um lobo seu (R perto do cercado): abaixo de que vínculo ele te ataca ao sair, a mordida (vida)
    e a que distância (tiles) ela pega. */
const SOLTAR = { atacaAbaixo: 1, dano: 8, alcance: 0.6 };
/** v7.7 — passo 5a: o filhote do Caçador solto pelo acampamento. Dias depois de os pais irem embora para começar a
    sair, chance de estar solto em cada visita, carnes na mochila para ele vir até você, distâncias (tiles). */
const FILHOTE = { soltoDias: 1, chance: 0.6, carneMin: 3, perto: 1.1, rodaCacador: 2.4, cheiro: 6, vel: 40, corre: 70 };
/** O filhote solto nesta visita ao acampamento (null = está no cercado). */
interface Solto2 {
  L: LoboCercado;
  x: number;
  y: number;
  yaw: number;
  alvo: { x: number; y: number } | null;
  t: number;
  seguindo: boolean;
}
/** v7.7 — a porteira (lado esquerdo, virado para a fogueira): meia largura da abertura e distância para o E
    (tiles); abaixo de que vínculo o lobo foge com ela aberta; em quantos dias o Caçador recupera um lobo dele que
    fugiu; quanto tempo (s) ela fica aberta sozinha quando os pais são soltos. */
const PORTA = { meia: 0.45, perto: 0.8, fogeAbaixo: 2, voltaDias: 1, auto: 4 };
const CC = {
  bichos: [] as Bicho[],
  soltos: [] as LoboSolto[],
  t0: 0,
  livre: null as Solto2 | null,
  aberta: false, // a porteira (fecha sozinha quando você sai do acampamento)
  auto: 0, // s em que ela fica aberta só para os pais soltos saírem
  folha: 0, // 0 fechada … 1 aberta (animação)
  dentro: false, // a heroína está dentro do cercado
  rastro: [] as { x: number; y: number }[], // v7.7: o caminho recente da heroína (o lobo na coleira vem por ele)
  menu: null as { L: LoboCercado; el: HTMLElement; t: number; acoes: AcaoLobo[] } | null, // v7.7: o menu aberto
  alimentar: null as LoboCercado | null, // v7.7: a mochila está aberta para escolher a comida deste lobo
};
/** v7.7 — uma opção do menu do lobo. */
interface AcaoLobo {
  texto: string;
  nota?: string; // por que está apagada, ou o efeito
  ok: boolean;
  fazer: () => void;
}

function dia() {
  return Math.floor(world.tick / CONFIG.DAY_MIN);
}
/** O retângulo do cercado no campo do acampamento (centro e meias medidas, mundo), ou null fora dele. Existe com
    algum lobo (no cercado, fugido ou saindo agora) e, v7.7 (5b), depois que o Caçador o fez, mesmo vazio. */
function cercadoRet() {
  const d = dungeon,
    F = CPS.fire;
  if (!d.active || !d.camp || !F) return null;
  const tem =
    (econ.lobos && econ.lobos.length) ||
    (econ.lobosFugidos || []).length ||
    CC.soltos.length ||
    campanha().feitas.a3_cercado != null;
  if (!tem) return null;
  const T = d.tile;
  return { x: F.x + CERCADO.dx * T, y: F.y + CERCADO.dy * T, w: CERCADO.mw * T, h: CERCADO.mh * T };
}

/** O nível de vínculo (0..4) pelos pontos. */
export function nivelVinculo(L: LoboCercado) {
  let n = 0;
  for (const p of VINCULO.niveis) if ((L.pontos || 0) >= p) n++;
  return n;
}
/** Os dias que passaram desde a última conta: o lobo do Caçador ganha pontos (ele alimenta todo dia); o seu
    (passo 5b) ninguém trata: cada dia em que ele não comeu da sua mão tira VINCULO.descuidoDia. */
function cacadorTrata() {
  const hoje = dia();
  for (const L of econ.lobos || []) {
    if (L.comHeroi) continue; // ainda no caminho, com a heroína
    if (L.diaCacador == null) L.diaCacador = Math.floor(L.desde / CONFIG.DAY_MIN);
    if (hoje > L.diaCacador) {
      const dias = hoje - L.diaCacador;
      if (L.dono === "jogador") {
        const comeu = L.comeuDia != null && L.comeuDia >= L.diaCacador ? 1 : 0;
        L.pontos = Math.max(0, (L.pontos || 0) - Math.max(0, dias - comeu) * VINCULO.descuidoDia);
      } else L.pontos = (L.pontos || 0) + dias * VINCULO.cacadorDia;
      L.diaCacador = hoje;
    }
    L.vinculo = nivelVinculo(L);
  }
}

function malha() {
  if (GL3.mesh.cercado) return GL3.mesh.cercado;
  const T = dungeon.tile,
    w = CERCADO.mw * T,
    h = CERCADO.mh * T,
    o = MB(),
    madeira = "#6a4a2a",
    corda = "#c9a46a",
    passo = CERCADO.estaca * T;
  // estacas pelo contorno; o lado esquerdo tem a abertura da porteira (dois mourões mais grossos)
  const g = PORTA.meia * T,
    lados: [number, number, number, number][] = [
      [-w, -h, w, -h],
      [w, -h, w, h],
      [w, h, -w, h],
      [-w, h, -w, g],
      [-w, -g, -w, -h],
    ];
  for (const z of [-g, g]) mbCyl(o, M4.ch(M4.T(-w, 0, z), M4.S(3.2, 20, 3.2)), madeira, 6, 0.85, 0.1);
  for (const [x0, y0, x1, y1] of lados) {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / passo));
    for (let i = 0; i < n; i++) {
      const k = i / n;
      mbCyl(o, M4.ch(M4.T(x0 + (x1 - x0) * k, 0, y0 + (y1 - y0) * k), M4.S(2.2, 18, 2.2)), madeira, 6, 0.8, 0.1);
    }
    // duas cordas por lado
    const cx = (x0 + x1) / 2,
      cy = (y0 + y1) / 2,
      len = Math.hypot(x1 - x0, y1 - y0),
      ang = Math.atan2(y1 - y0, x1 - x0);
    for (const alt of [8, 14]) mbBox(o, M4.ch(M4.T(cx, alt, cy), M4.RY(-ang), M4.S(len, 0.8, 0.8)), corda, 1, 0.05);
  }
  // palha no chão e a tigela de água
  mbBox(o, M4.ch(M4.T(-w * 0.55, 0.3, -h * 0.45), M4.RY(0.4), M4.S(w * 0.5, 0.6, h * 0.45)), "#b9a25a", 1, 0.15);
  mbCyl(o, M4.ch(M4.T(w * 0.6, 0, h * 0.5), M4.S(9, 2.5, 9)), "#5a5148", 10, 1);
  mbCyl(o, M4.ch(M4.T(w * 0.6, 0.6, h * 0.5), M4.S(7, 2.2, 7)), "#4a7ab0", 10, 1);
  return (GL3.mesh.cercado = glMesh(o));
}
/** A folha da porteira: duas tábuas e uma diagonal, da dobradiça (z = 0) até z = 2 × PORTA.meia. */
function malhaFolha() {
  if (GL3.mesh.cercadoFolha) return GL3.mesh.cercadoFolha;
  const L = 2 * PORTA.meia * dungeon.tile,
    o = MB(),
    tabua = "#7a5532";
  for (const alt of [6, 13]) mbBox(o, M4.ch(M4.T(0, alt, L / 2), M4.S(1.4, 2.2, L)), tabua, 1, 0.08);
  mbBox(o, M4.ch(M4.T(0, 9.5, L / 2), M4.RX(Math.atan2(7, L)), M4.S(1.2, 1.8, Math.hypot(L, 7))), tabua, 1, 0.08);
  mbBox(o, M4.ch(M4.T(0, 9.5, L - 1), M4.S(1.4, 10, 1.6)), tabua, 1, 0.08);
  return (GL3.mesh.cercadoFolha = glMesh(o));
}

/** Os lobos andando no cercado (cria quando muda a lista de econ.lobos; o filhote solto fica de fora). */
function bichos(R: { x: number; y: number; w: number; h: number }) {
  const lobos = (econ.lobos || []).filter((L) => (!CC.livre || CC.livre.L !== L) && !L.comHeroi);
  if (CC.bichos.length !== lobos.length || CC.bichos.some((b, i) => b.L !== lobos[i]))
    // v7.7: quem já estava continua onde estava (antes todos voltavam ao meio quando um saía)
    CC.bichos = lobos.map((L, i) => {
      const ja = CC.bichos.find((b) => b.L === L);
      if (ja) return ja;
      const b: Bicho = {
        L,
        x: R.x + (i % 2 ? 0.4 : -0.4) * R.w,
        y: R.y + (i % 2 ? -0.3 : 0.3) * R.h,
        yaw: i * 2,
        alvo: null,
        t: 0,
      };
      if (nivelVinculo(L) >= LIVRE.desde) {
        // v7.7: com vínculo ele já está solto pelo acampamento quando você chega
        const p = pontoLivre(R);
        b.x = p.x;
        b.y = p.y;
        b.fora = true;
      }
      return b;
    });
  return CC.bichos;
}
/** v7.7 — para os testes (__t): os lobos do cercado (os próprios objetos: posição, fora, guiado, alvo) e se a
    heroína está lá dentro. */
export function cercadoBichos() {
  return { dentro: CC.dentro, bichos: CC.bichos };
}
/** v7.7 — um ponto do acampamento em volta do cercado (fora dele) para o lobo solto passear. */
function pontoLivre(R: { x: number; y: number; w: number; h: number }) {
  const d = dungeon,
    T = d.tile;
  let p = { x: R.x, y: R.y + R.h + T };
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2,
      r = (LIVRE.raioMin + Math.random() * (LIVRE.raio - LIVRE.raioMin)) * T,
      q = {
        x: Math.max(T, Math.min(d.cols * T - T, R.x + Math.cos(a) * r)),
        y: Math.max(T, Math.min(d.rows * T - T, R.y + Math.sin(a) * r)),
      };
    if (Math.abs(q.x - R.x) > R.w + T * 0.6 || Math.abs(q.y - R.y) > R.h + T * 0.6) {
      p = q;
      break;
    }
  }
  return p;
}
/** v7.7 — as duas pontas da passagem da porteira (por fora e por dentro). */
function porta(R: { x: number; y: number; w: number }) {
  const T = dungeon.tile;
  return { fora: { x: R.x - R.w - T * 0.5, y: R.y }, dentro: { x: R.x - R.w + T * 0.5, y: R.y } };
}
/** v7.7 — o lobo solto (fora) não atravessa a cerca: empurrado para a borda mais perto. */
function foraDaCerca(b: Bicho, R: { x: number; y: number; w: number; h: number }) {
  const f = dungeon.tile * 0.35,
    dx = b.x - R.x,
    dy = b.y - R.y;
  if (Math.abs(dx) > R.w + f || Math.abs(dy) > R.h + f) return;
  if (R.w + f - Math.abs(dx) < R.h + f - Math.abs(dy)) b.x = R.x + Math.sign(dx || 1) * (R.w + f);
  else b.y = R.y + Math.sign(dy || 1) * (R.h + f);
}
/** v7.7 — o passo de um lobo que não está no jeito antigo (dentro, preso): na coleira, passando pela porteira, solto
    pelo acampamento ou seguindo você dentro do cercado. Devolve o alvo e a velocidade, ou null = jeito antigo. */
function passoLivre(b: Bicho, R: { x: number; y: number; w: number; h: number }, nv: number, dt: number) {
  const d = dungeon,
    T = d.tile,
    P = porta(R),
    aberta = CC.aberta || CC.auto > 0;
  if (b.guiado) {
    // na coleira: vem pelo caminho que você fez, a COLEIRA.dist atrás
    const alvo = pontoNoRastro(COLEIRA.dist * T);
    b.fora = !(Math.abs(b.x - R.x) < R.w && Math.abs(b.y - R.y) < R.h);
    return { alvo, vel: COLEIRA.vel };
  }
  if (b.rota && b.rota.length) {
    // passando pela porteira (ela abre sozinha um instante para ele)
    CC.auto = Math.max(CC.auto, 0.6);
    const alvo = b.rota[0];
    if (Math.hypot(alvo.x - b.x, alvo.y - b.y) < T * 0.25) {
      b.rota.shift();
      if (!b.rota.length) {
        b.fora = alvo.x < R.x - R.w; // a última ponta: a de fora ou a de dentro
        b.rota = undefined;
      }
    }
    return { alvo, vel: LIVRE.corre * 0.7 };
  }
  const livre = nv >= LIVRE.desde;
  if (b.fora && !livre) {
    // pouco vínculo e do lado de fora (soltou a corda): volta para o cercado
    b.rota = [P.fora, P.dentro];
    return { alvo: P.fora, vel: LIVRE.corre * 0.7 };
  }
  if (!livre) return null;
  if (CC.dentro) {
    if (b.fora) {
      // você entrou no cercado: ele vem pela porteira (espera nela se estiver fechada)
      if (aberta && Math.hypot(P.fora.x - b.x, P.fora.y - b.y) < T * 0.4) b.rota = [P.dentro];
      return { alvo: P.fora, vel: LIVRE.corre };
    }
    // dentro com você: segue a LIVRE.segue tiles
    const a = Math.atan2(b.y - d.py, b.x - d.px),
      m = T * 0.45,
      alvo = {
        x: Math.max(R.x - R.w + m, Math.min(R.x + R.w - m, d.px + Math.cos(a) * LIVRE.segue * T)),
        y: Math.max(R.y - R.h + m, Math.min(R.y + R.h - m, d.py + Math.sin(a) * LIVRE.segue * T)),
      };
    return { alvo, vel: Math.hypot(d.px - b.x, d.py - b.y) > LIVRE.segue * T * 2.5 ? LIVRE.corre : LIVRE.vel };
  }
  if (!b.fora) {
    // você está fora e ele dentro: sai quando a porteira abrir; fechada, passeia lá dentro (null = jeito antigo)
    if (aberta) {
      b.rota = [P.dentro, P.fora];
      return { alvo: P.dentro, vel: LIVRE.vel };
    }
    return null;
  }
  // solto pelo acampamento: passeia em volta do cercado
  if (!b.alvo || (b.t -= dt) <= 0) {
    b.t = 3 + Math.random() * 5;
    b.alvo = pontoLivre(R);
  }
  return { alvo: b.alvo, vel: LIVRE.vel };
}
/** v7.7 — o ponto do seu caminho recente a `dist` atrás de você (o lobo na coleira vai até ele). */
function pontoNoRastro(dist: number) {
  const d = dungeon,
    r = CC.rastro;
  let x = d.px,
    y = d.py,
    falta = dist;
  for (let i = r.length - 1; i >= 0; i--) {
    const q = Math.hypot(r[i].x - x, r[i].y - y);
    if (q >= falta) return { x: x + ((r[i].x - x) / q) * falta, y: y + ((r[i].y - y) / q) * falta };
    falta -= q;
    x = r[i].x;
    y = r[i].y;
  }
  return { x, y };
}
/** v7.7 — guarda o caminho da heroína (pontos a cada poucos px; só o bastante para a coleira). */
function anotarRastro() {
  const d = dungeon,
    r = CC.rastro,
    u = r[r.length - 1];
  if (!u || Math.hypot(d.px - u.x, d.py - u.y) > 4) r.push({ x: d.px, y: d.py });
  if (r.length > 80) r.shift();
}

/** Um passo dos lobos: passeiam; com pouco vínculo se afastam de quem chega; com muito vêm até a cerca. */
function andar(R: { x: number; y: number; w: number; h: number }, dt: number) {
  const d = dungeon,
    T = d.tile,
    m = T * 0.45, // folga da cerca
    fugiram: Bicho[] = [];
  anotarRastro();
  for (const b of bichos(R)) {
    const nv = nivelVinculo(b.L),
      dist = Math.hypot(d.px - b.x, d.py - b.y),
      medo = LOBO_C.medo[nv] * T,
      lv = passoLivre(b, R, nv, dt); // v7.7: solto, na coleira, passando pela porteira, seguindo você
    let vel = LOBO_C.vel;
    if (lv) {
      const ax = lv.alvo.x - b.x,
        ay = lv.alvo.y - b.y,
        q = Math.hypot(ax, ay);
      if (q > 3) {
        const s = Math.min(q, lv.vel * dt);
        b.x += (ax / q) * s;
        b.y += (ay / q) * s;
        b.yaw = Math.atan2(ay, ax);
      } else if (dist < T * 3) b.yaw = Math.atan2(d.py - b.y, d.px - b.x);
      if (b.fora && !b.guiado && !b.rota) foraDaCerca(b, R);
      continue;
    }
    if (CC.aberta && nv < PORTA.fogeAbaixo) {
      // v7.7: porteira aberta e pouco vínculo: corre para ela e foge
      b.alvo = { x: R.x - R.w + m * 0.4, y: R.y };
      vel = LOBO_C.velFoge;
      if (Math.hypot(b.alvo.x - b.x, b.alvo.y - b.y) < T * 0.35) fugiram.push(b);
    } else if (medo && dist < medo) {
      // foge para o lado oposto ao jogador
      b.alvo = { x: R.x - Math.sign(d.px - R.x || 1) * (R.w - m), y: R.y - Math.sign(d.py - R.y || 1) * (R.h - m) };
      vel = LOBO_C.velFoge;
    } else if (LOBO_C.vem[nv] && dist < T * 3) {
      b.alvo = {
        x: Math.max(R.x - R.w + m, Math.min(R.x + R.w - m, d.px)),
        y: Math.max(R.y - R.h + m, Math.min(R.y + R.h - m, d.py)),
      };
    } else if (!b.alvo || (b.t -= dt) <= 0) {
      b.t = 2 + Math.random() * 4;
      b.alvo = { x: R.x + (Math.random() * 2 - 1) * (R.w - m), y: R.y + (Math.random() * 2 - 1) * (R.h - m) };
    }
    const ax = b.alvo.x - b.x,
      ay = b.alvo.y - b.y,
      q = Math.hypot(ax, ay);
    if (q > 3) {
      const s = Math.min(q, vel * dt);
      b.x += (ax / q) * s;
      b.y += (ay / q) * s;
      b.yaw = Math.atan2(ay, ax);
    } else if (LOBO_C.vem[nv] && dist < T * 3) b.yaw = Math.atan2(d.py - b.y, d.px - b.x);
  }
  for (const b of fugiram) fugiu(b, R);
}

/** O tamanho de um lobo do cercado (o filhote é pequeno; o adulto, o da ficha do bicho do campo). */
function escalaDe(L: LoboCercado) {
  return L.filhote ? LOBO_C.filhote : L.ficha?.escala || LOBO_C.escala;
}
/** Um lobo saiu pela porteira aberta: vai embora correndo. Se era do Caçador, ele o recupera em PORTA.voltaDias. */
function fugiu(b: Bicho, R: { x: number; y: number; w: number; h: number }) {
  const T = dungeon.tile;
  CC.soltos.push({
    x: b.x,
    y: b.y,
    yaw: Math.PI,
    pelagem: b.L.pelagem,
    escala: escalaDe(b.L),
    rodeia: 0,
    ang: 0,
    rota: [{ x: R.x - R.w - T, y: R.y }],
  });
  econ.lobos = (econ.lobos || []).filter((L) => L !== b.L);
  if (b.L.dono === "cacador")
    (econ.lobosFugidos ||= []).push({ L: b.L, volta: world.tick + PORTA.voltaDias * CONFIG.DAY_MIN });
  // v7.7: o do Caçador ele vai buscar (volta em PORTA.voltaDias); diz isso, senão parecia perdido de vez
  const txt = b.L.dono === "cacador" ? "🐺 O lobo fugiu pela porteira! O Caçador vai atrás dele" : "🐺 O lobo fugiu!";
  spawnDungeonToast(txt, b.x, b.y - 40, "#ff9a7a", 13);
  if (b.L.dono === "cacador") pushEvent(txt + " (volta amanhã)");
  sfx("guardbreak");
}

/** A cerca: dentro ou fora, a heroína só atravessa pela porteira aberta (o lado esquerdo, no meio). */
function cerca(R: { x: number; y: number; w: number; h: number }) {
  const d = dungeon,
    f = d.tile * 0.25,
    g = PORTA.meia * d.tile - f * 0.6,
    dx = d.px - R.x,
    dy = d.py - R.y,
    naPorta = CC.aberta && Math.abs(dy) < g;
  if (CC.dentro) {
    if (naPorta && dx < -(R.w - f)) {
      if (dx < -(R.w + f)) CC.dentro = false; // saiu
      return;
    }
    d.px = Math.max(R.x - R.w + f, Math.min(R.x + R.w - f, d.px));
    d.py = Math.max(R.y - R.h + f, Math.min(R.y + R.h - f, d.py));
    return;
  }
  if (Math.abs(dx) > R.w + f || Math.abs(dy) > R.h + f) return;
  if (naPorta && dx < 0) {
    if (dx > -(R.w - f)) CC.dentro = true; // entrou
    return;
  }
  if (R.w + f - Math.abs(dx) < R.h + f - Math.abs(dy)) d.px = R.x + Math.sign(dx || 1) * (R.w + f);
  else d.py = R.y + Math.sign(dy || 1) * (R.h + f);
}

/** A folha da porteira: gira para fora (para a esquerda) quando abre. */
function porteiraGL(R: { x: number; y: number; w: number }, dt: number) {
  const alvo = CC.aberta || CC.auto > 0 ? 1 : 0;
  if (CC.auto > 0) CC.auto -= dt;
  CC.folha += Math.max(-dt * 3, Math.min(dt * 3, alvo - CC.folha));
  const g = PORTA.meia * dungeon.tile;
  glPush(malhaFolha(), M4.ch(M4.T(R.x - R.w, 0, R.y - g), M4.RY(-CC.folha * Math.PI * 0.5)));
}
/** Perto da porteira (por dentro ou por fora): o E abre ou fecha. */
function pertoDaPorta() {
  const R = cercadoRet();
  if (!R) return false;
  const d = dungeon;
  return Math.hypot(d.px - (R.x - R.w), d.py - R.y) < PORTA.perto * d.tile;
}
function trocarPorta() {
  CC.aberta = !CC.aberta;
  sfx("swing");
}

/** Desenho 3D (campNapGL chama a cada quadro do acampamento): cerca, lobos; também anda e confere a cerca. */
export function cercadoGL() {
  const R = cercadoRet();
  if (!R) return;
  const agora = performance.now();
  if (agora - CC.t0 > 1500) novaVisita(); // ficou um tempo sem desenhar = entrou de novo no acampamento
  const dt = Math.min(0.1, (agora - (CC.t0 || agora)) / 1000);
  CC.t0 = agora;
  cacadorTrata();
  filhoteLivreGL(dt);
  andar(R, dt);
  cerca(R);
  glPush(malha(), M4.T(R.x, 0, R.y));
  porteiraGL(R, dt);
  for (const b of CC.bichos) {
    const ma = bichoAnimado(b, "lobo", b.x, b.y, { tom: tomPelagem(b.L.pelagem % 6) });
    if (ma)
      glPush(
        ma,
        // v7.7: o tamanho do bicho capturado (FichaLobo), o mesmo do campo
        M4.ch(
          M4.T(b.x, 0, b.y),
          M4.RY(-b.yaw),
          M4.S(b.L.filhote ? LOBO_C.filhote : b.L.ficha?.escala || LOBO_C.escala),
        ),
      );
    if (b.guiado) coleiraGL(b);
  }
  if (CC.alimentar && !dungeon.invOpen) CC.alimentar = null; // fechou a mochila sem escolher
  if (CC.menu && !alvoAinda(CC.menu.L)) fecharMenuLobo();
  soltosGL(dt);
  if (Math.hypot(dungeon.px - R.x, dungeon.py - R.y) < Math.max(R.w, R.h) + dungeon.tile * 1.5)
    campanhaEvento("cercadoVisto");
}

/* ---------- v7.7 — o lobo que a heroína leva pelo mapa (saiu do campo na corda: LoboCercado.comHeroi) ---------- */
/** Chegou ao acampamento (parada nele no mapa, ou na cena do acampamento): o lobo vai para o cercado. */
function loboChegou() {
  for (const L of econ.lobos || []) {
    if (!L.comHeroi) continue;
    const h = world.heroes.find((x) => x.id === L.comHeroi);
    if (h && h.state !== "idle" && !(dungeon.active && dungeon.camp && dungeon.hero === h)) continue;
    delete L.comHeroi;
    const txt = "🐺 " + (h ? h.name : "A heroína") + " levou o lobo para o cercado";
    pushEvent(txt);
    try {
      mvToast(txt);
    } catch (_) {}
  }
}
/** No mapa (drawHero chama): o lobo que ela leva, ao lado dela, preso pela corda. */
export function desenharLoboCarregado(h: { id: string; x: number; y: number }, c: CanvasRenderingContext2D) {
  const L = (econ.lobos || []).find((x) => x.comHeroi === h.id);
  if (!L) return;
  const t = performance.now() / 1000,
    x = h.x - 10,
    y = h.y + 4 + Math.sin(t * 6) * 0.6;
  c.save();
  c.strokeStyle = "#d8b47a";
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(h.x - 2, h.y + 1);
  c.quadraticCurveTo((h.x + x) / 2, (h.y + y) / 2 + 3, x + 2, y - 1);
  c.stroke();
  const sz = fitSz(13);
  if (!(ATLAS.complete && ATLAS.naturalWidth > 0 && drawSprite("wolf", L.sexo, 0, x, y, sz, 1, null, c))) {
    c.fillStyle = "#8a8f96";
    c.beginPath();
    c.ellipse(x, y, 4.5, 2.6, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

/* ---------- passo 4: o casal, o filhote e soltar os pais ---------- */
function adultos(dono: LoboCercado["dono"] = "cacador") {
  return (econ.lobos || []).filter((L) => !L.filhote && L.dono === dono && !L.comHeroi);
}
function filhote(dono: LoboCercado["dono"] = "cacador") {
  return (econ.lobos || []).find((L) => L.filhote && L.dono === dono) || null;
}
/** De quem são os pais que ainda estão no cercado com o filhote (o E na cerca solta): o Caçador primeiro. */
function paisParaSoltar(): LoboCercado["dono"] | null {
  if (filhote() && adultos().length) return "cacador";
  const f = filhote("jogador"); // v7.7 (5b): o seu, enquanto ainda dá tempo
  if (f && !f.cresceuLobo && !f.semPais && adultos("jogador").length) return "jogador";
  return null;
}
/** v7.7 (5b) — como um lobo adulto sai do cercado, pelo vínculo: 0 te ataca e foge, 1–2 foge, 3–4 rodeia e vai. */
function saida(L: LoboCercado, R: { x: number; y: number; w: number }): LoboSolto {
  const T = dungeon.tile,
    b = CC.bichos.find((x) => x.L === L),
    nv = nivelVinculo(L);
  return {
    x: b ? b.x : R.x,
    y: b ? b.y : R.y,
    yaw: 0,
    pelagem: L.pelagem,
    escala: escalaDe(L),
    rodeia: nv >= CASAL.rodeiaDesde ? CASAL.rodeiaS : 0,
    ang: Math.PI, // começam a rodear do lado da porteira
    rota:
      b && b.fora
        ? [] // v7.7: já solto pelo acampamento, não passa pela porteira
        : [
            { x: R.x - R.w + T * 0.5, y: R.y },
            { x: R.x - R.w - T * 0.8, y: R.y },
          ],
    ataca: nv < SOLTAR.atacaAbaixo,
  };
}
/** v7.7 — o lobo do menu: o mais perto de você até MENU_LOBO.alcance (solto, no cercado ou o filhote livre); senão,
    perto da cerca, o mais perto lá dentro (o de pouco vínculo foge de você, então dá para dar comida de longe). */
function alvoLobo(): { L: LoboCercado; x: number; y: number; b: Bicho | null; perto: boolean } | null {
  const d = dungeon,
    R = cercadoRet(),
    alc = MENU_LOBO.alcance * d.tile;
  if (!d.active || !d.camp) return null;
  const perto: { L: LoboCercado; x: number; y: number; b: Bicho | null }[] = [];
  if (CC.livre && pertoDoFilhoteLivre()) perto.push({ L: CC.livre.L, x: CC.livre.x, y: CC.livre.y, b: null });
  // o solto que passa perto da bigorna, do baú, da tenda… não toma o E delas (a coleira, sim)
  const estacao = !!campNear();
  if (R)
    for (const b of CC.bichos)
      if (b.guiado || (Math.hypot(b.x - d.px, b.y - d.py) < alc && !(b.fora && estacao)))
        perto.push({ L: b.L, x: b.x, y: b.y, b });
  // ninguém ao alcance: perto da cerca (por fora), o mais perto lá dentro, de longe
  const longe = !perto.length;
  if (longe && R && pertoDoCercado() && !CC.dentro)
    for (const b of CC.bichos) if (!b.fora && !b.rota) perto.push({ L: b.L, x: b.x, y: b.y, b });
  const dist = (o: { x: number; y: number }) => Math.hypot(o.x - d.px, o.y - d.py),
    o = perto.sort((p, q) => dist(p) - dist(q))[0];
  return o ? { ...o, perto: !longe && dist(o) < alc } : null;
}
/** O menu continua valendo para este lobo (ele ainda está ali e você perto)? */
function alvoAinda(L: LoboCercado) {
  const a = alvoLobo();
  return !!a && a.L === L;
}
/** A descrição curta do lobo (painel e menu). */
function descLobo(L: LoboCercado) {
  return (
    (L.filhote ? "filhote " : "") +
    (L.sexo === "M" ? "♂" : "♀") +
    (L.dono === "jogador" ? " seu" : " do Caçador") +
    " · vínculo " +
    nivelVinculo(L) +
    "/4"
  );
}
/** v7.7 — as opções do menu para o lobo `a`. */
function acoesLobo(a: NonNullable<ReturnType<typeof alvoLobo>>): AcaoLobo[] {
  const L = a.L,
    b = a.b,
    hoje = dia(),
    lista: AcaoLobo[] = [],
    longe = "chegue mais perto";
  lista.push({
    texto: "🤚 Afagar",
    ok: a.perto,
    nota: !a.perto ? longe : L.afagoDia === hoje ? "já hoje: só carinho" : "+vínculo (1× por dia)",
    fazer: () => afagar(L, a),
  });
  const comida = comidasNaMochila();
  lista.push({
    texto: "🍖 Dar comida",
    ok: L.comeuDia !== hoje && comida > 0,
    nota: L.comeuDia === hoje ? "já comeu hoje" : comida ? "escolha na mochila" : "sem comida na mochila",
    fazer: () => abrirComida(L),
  });
  if (b) {
    if (b.guiado) lista.push({ texto: "🪢 Soltar a corda", ok: true, fazer: () => soltarCorda(b) });
    else {
      const mesmoLado = !!b.fora === !CC.dentro;
      lista.push({
        texto: "🪢 Conduzir na coleira",
        ok: a.perto && mesmoLado && !b.rota,
        nota: !a.perto ? longe : !mesmoLado ? "a cerca está entre vocês" : "ele vem atrás de você",
        fazer: () => conduzir(b),
      });
    }
  }
  const pais = paisParaSoltar();
  if (pais && b && L.dono === pais && !b.guiado)
    // no menu de qualquer um da família (o filhote fica no cercado)
    lista.push({
      texto: pais === "jogador" ? "🐾 Soltar os pais do seu filhote" : "🐾 Soltar os pais",
      ok: true,
      fazer: () => soltarPais(false, pais),
    });
  else if (b && L.dono === "jogador" && !L.filhote && !b.guiado)
    lista.push({
      texto: "🐾 Soltar este lobo",
      ok: true,
      nota: nivelVinculo(L) < SOLTAR.atacaAbaixo ? "ele não confia em você" : "vai embora",
      fazer: () => soltarLobo(L),
    });
  return lista;
}
/** v7.7 — E perto de um lobo: abre o menu dele (1–5 ou clique escolhe; E/Esc fecha). */
function abrirMenuLobo() {
  const a = alvoLobo();
  if (!a) return false;
  fecharMenuLobo();
  const d = dungeon,
    acoes = acoesLobo(a),
    el = document.createElement("div");
  el.id = "lobo-menu";
  el.innerHTML =
    "<b>🐺 Lobo</b><small>" +
    descLobo(a.L) +
    "</small>" +
    acoes
      .map(
        (o, i) =>
          '<button class="btn" data-i="' +
          i +
          '"' +
          (o.ok ? "" : " disabled") +
          "><kbd>" +
          (i + 1) +
          "</kbd>" +
          o.texto +
          (o.nota ? "<i>" + o.nota + "</i>" : "") +
          "</button>",
      )
      .join("") +
    '<button class="btn" data-i="x"><kbd>E</kbd>Fechar</button>';
  el.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest("button");
    if (btn) escolherNoMenu(btn.dataset.i === "x" ? -1 : Number(btn.dataset.i));
  });
  document.body.appendChild(el);
  CC.menu = { L: a.L, el, t: performance.now(), acoes };
  d.modalOpen = true;
  d.keys = {};
  sfx("swing");
  return true;
}
function fecharMenuLobo() {
  if (!CC.menu) return;
  CC.menu.el.remove();
  CC.menu = null;
  dungeon.modalOpen = false;
}
/** A opção `i` do menu (−1 = fechar). */
function escolherNoMenu(i: number) {
  const M = CC.menu;
  if (!M) return;
  const o = M.acoes[i];
  if (i >= 0 && (!o || !o.ok)) return;
  fecharMenuLobo();
  if (o) o.fazer();
}
/** v7.7 — as teclas com o menu aberto (iniciarCampanha): 1–5 escolhem, E/Esc fecham. Devolve true se usou a tecla. */
export function teclaMenuLobo(code: string) {
  if (!CC.menu) return false;
  if (code === "Escape" || (code === "KeyE" && performance.now() - CC.menu.t > 200)) {
    fecharMenuLobo();
    return true;
  }
  const n = /^(?:Digit|Numpad)([1-9])$/.exec(code);
  if (n) {
    escolherNoMenu(Number(n[1]) - 1);
    return true;
  }
  return code === "KeyE";
}
function afagar(L: LoboCercado, onde: { x: number; y: number }) {
  const hoje = dia(),
    antes = nivelVinculo(L);
  if (L.afagoDia !== hoje) {
    L.afagoDia = hoje;
    L.pontos = (L.pontos || 0) + MENU_LOBO.afago;
    L.vinculo = nivelVinculo(L);
  }
  const txt =
    L.vinculo > antes
      ? "🐺 Vínculo " + L.vinculo + "/4!"
      : antes < 2
        ? "🐺 Ele estranha, mas deixa"
        : "🐺 Abana o rabo";
  spawnDungeonToast(txt, onde.x, onde.y - 40, "#ffe08a", 13);
  sfx(L.vinculo > antes ? "perfect" : "near");
}
/** Dar comida: abre a mochila; no menu do item (ui: invItemMenu) aparece "Dar ao lobo". */
function abrirComida(L: LoboCercado) {
  CC.alimentar = L;
  toggleInv(true);
  itemMsg('🐺 Toque na comida e escolha "Dar ao lobo"');
}
/** v7.7 — no menu do item da mochila: a linha "Dar ao lobo" (só com a mochila aberta pelo menu do lobo). */
export function opcaoDarAoLobo(it: Item) {
  const L = CC.alimentar;
  if (!L || !dungeon.invOpen || COMIDA_LOBO[it.def.key] == null) return null;
  return "🐺 Dar ao lobo (" + descLobo(L) + ")";
}
/** "Dar ao lobo": tira uma do monte, dá o vínculo e fecha a mochila. */
export function darAoLobo(it: Item, inv: InvGrid) {
  const L = CC.alimentar;
  if (!L) return;
  CC.alimentar = null;
  const b = CC.bichos.find((x) => x.L === L) || (CC.livre && CC.livre.L === L ? CC.livre : null);
  darComida(L, b, it, inv);
  toggleInv(false);
}
function conduzir(b: Bicho) {
  for (const o of CC.bichos) o.guiado = false; // uma corda só
  b.guiado = true;
  b.rota = undefined;
  CC.rastro = [{ x: b.x, y: b.y }]; // o caminho começa nele
  spawnDungeonToast("🪢 Na coleira", b.x, b.y - 40, "#ffe08a", 12);
  sfx("swing");
}
function soltarCorda(b: Bicho) {
  b.guiado = false;
  b.alvo = null;
  const fica = nivelVinculo(b.L) >= LIVRE.desde;
  spawnDungeonToast(fica ? "🐺 LoboSolto pelo acampamento" : "🐺 Volta para o cercado", b.x, b.y - 40, "#ffe08a", 12);
  sfx("swing");
}
/** A corda da coleira: duas partes (da mão até o meio, caída, e do meio até o pescoço dele). */
function coleiraGL(b: Bicho) {
  const d = dungeon,
    m =
      GL3.mesh.coleira ||
      (GL3.mesh.coleira = (() => {
        const o = MB();
        mbBox(o, M4.id(), "#c9a46a", 1, 0.05);
        return glMesh(o);
      })()),
    A = { x: d.px, y: 11, z: d.py },
    B = { x: b.x + Math.cos(b.yaw) * 7, y: 8, z: b.y + Math.sin(b.yaw) * 7 },
    folga = Math.max(0, 1 - Math.hypot(B.x - A.x, B.z - A.z) / (COLEIRA.dist * d.tile)),
    C = { x: (A.x + B.x) / 2, y: 7 - folga * 5, z: (A.z + B.z) / 2 };
  for (const [p, q] of [
    [A, C],
    [C, B],
  ]) {
    const dx = q.x - p.x,
      dz = q.z - p.z,
      h = Math.hypot(dx, dz);
    glPush(
      m,
      M4.ch(
        M4.T((p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2),
        M4.RY(-Math.atan2(dz, dx)),
        M4.RZ(Math.atan2(q.y - p.y, h)),
        M4.S(Math.hypot(h, q.y - p.y), 0.7, 0.7),
      ),
    );
  }
}
/** Solta um lobo seu; o que ele faz sai do vínculo (saida). */
function soltarLobo(L: LoboCercado) {
  const R = cercadoRet();
  if (!R) return false;
  const s = saida(L, R);
  CC.soltos.push(s);
  CC.auto = PORTA.auto;
  econ.lobos = (econ.lobos || []).filter((x) => x !== L);
  const txt = s.ataca
    ? "😡 Ele não confia em você!"
    : s.rodeia > 0
      ? "🐺 Ele fica um pouco por perto…"
      : "🐺 Foi embora";
  spawnDungeonToast(txt, dungeon.px, dungeon.py - 46, s.ataca ? "#ff9a7a" : "#ffe08a", 13);
  sfx(s.ataca ? "guardbreak" : "swing");
  return true;
}

/** De tempos em tempos (iniciarCampanha): o 2º lobo que o Caçador traz, o nascimento, e o prazo dos pais. */
export function casalTick() {
  loboChegou();
  // v7.7: o Caçador recupera os lobos dele que fugiram pela porteira
  const voltam = (econ.lobosFugidos || []).filter((f) => world.tick >= f.volta);
  if (voltam.length) {
    econ.lobosFugidos = econ.lobosFugidos!.filter((f) => !voltam.includes(f));
    for (const f of voltam) (econ.lobos ||= []).push(f.L);
    pushEvent("🐺 O Caçador recuperou o lobo que tinha fugido do cercado");
  }
  limparFilhotesRepetidos();
  const lobos = econ.lobos;
  if (!lobos || !lobos.length) return;
  cacadorTrata();
  const A = adultos(),
    F = filhote(),
    C = campanha(),
    // v7.7: os que fugiram pela porteira também contam (senão um pai ou o filhote fugido "faltava" e vinha outro)
    fugidos = (econ.lobosFugidos || []).map((f) => f.L).filter((L) => L.dono === "cacador"),
    adultosTodos = A.length + fugidos.filter((L) => !L.filhote).length;
  if (!C.flags.filhoteNasceu && (F || fugidos.some((L) => L.filhote))) C.flags.filhoteNasceu = true; // saves de antes
  // o 2º lobo: o Caçador laça sozinho um do sexo oposto (sem missão)
  if (
    adultosTodos === 1 &&
    A.length === 1 &&
    !F &&
    !C.flags.segundoLobo &&
    world.tick - A[0].desde >= CASAL.segundoDias * CONFIG.DAY_MIN
  ) {
    C.flags.segundoLobo = true;
    const sexo = A[0].sexo === "M" ? "F" : "M";
    lobos.push({ sexo, pelagem: Math.floor(Math.random() * 6), vinculo: 0, dono: "cacador", desde: world.tick });
    const txt = "🐺 " + FALAS_CURTAS.segundoLobo.replace("{um}", sexo === "F" ? "uma loba" : "um lobo");
    pushEvent(txt);
    try {
      mvToast(txt);
    } catch (_) {}
  }
  // o filhote: o casal no vínculo 4, depois do primeiro pedido de carne (v8.0: a linha dos lobos chegou em a3_cuidar;
  // antes era depois da costura, quando as duas coisas estavam na mesma corrente)
  const casal = A.some((L) => L.sexo === "M") && A.some((L) => L.sexo === "F");
  // v7.7: uma vez só (C.flags.filhoteNasceu): o filhote que fugiu pela porteira o Caçador traz de volta; antes, a
  // falta dele fazia nascer outro a cada quarto de segundo (e cada um fugia também)
  if (casal && !F && !C.flags.filhoteNasceu && C.feitas.a3_pedido != null && A.every((L) => nivelVinculo(L) >= 4)) {
    const mae = A.find((L) => L.sexo === "F")!,
      pai = A.find((L) => L.sexo === "M")!;
    C.flags.filhoteNasceu = true;
    lobos.push({
      sexo: Math.random() < 0.5 ? "M" : "F",
      pelagem: (Math.random() < 0.5 ? mae : pai).pelagem,
      vinculo: 0,
      dono: "cacador",
      desde: world.tick,
      filhote: true,
      prazo: world.tick + CASAL.prazoDias * CONFIG.DAY_MIN,
      pontos: 0,
    });
    pushEvent("🐺 Nasceu um filhote no cercado do Caçador");
    campanhaEvento("filhoteNasceu");
  }
  // o prazo: o próprio Caçador solta os pais
  const f = filhote();
  if (f && f.prazo != null && world.tick >= f.prazo && adultos().length) {
    soltarPais(true);
    pushEvent("🐺 " + FALAS_CURTAS.cacadorSoltou);
    try {
      mvToast("🐺 " + FALAS_CURTAS.cacadorSoltou);
    } catch (_) {}
  }
  casalDoJogador();
}

/** v7.7 — conserto de saves do bug dos filhotes que se multiplicavam com a porteira aberta: de cada dono fica só o
    primeiro filhote (no cercado ou fugido); os outros somem. */
function limparFilhotesRepetidos() {
  for (const dono of ["cacador", "jogador"] as const) {
    const todos = [...(econ.lobos || []), ...(econ.lobosFugidos || []).map((f) => f.L)].filter(
      (L) => L.filhote && L.dono === dono,
    );
    if (todos.length < 2) continue;
    const sai = new Set(todos.slice(1)), // fica o primeiro
      fica = todos[0];
    econ.lobos = (econ.lobos || []).filter((L) => !sai.has(L) || L === fica);
    econ.lobosFugidos = (econ.lobosFugidos || []).filter((f) => !sai.has(f.L) || f.L === fica);
    // o mesmo lobo duas vezes nas listas (no cercado e fugido ao mesmo tempo) também
    econ.lobos = econ.lobos.filter((L, i, a) => a.indexOf(L) === i);
    econ.lobosFugidos = econ.lobosFugidos.filter(
      (f, i, a) => a.findIndex((g) => g.L === f.L) === i && !econ.lobos!.includes(f.L),
    );
    pushEvent("🐺 Arrumado o cercado: " + sai.size + " filhote(s) repetido(s) removido(s)");
  }
}

/** v7.7 (5b) — o seu casal: no vínculo 4 nasce o seu filhote; você tem CASAL.prazoDias para soltar os pais (ninguém
    solta por você); passou o prazo com eles lá, o filhote cresce lobo (não vira pet). Soltou a tempo = `semPais`. */
function casalDoJogador() {
  const A = adultos("jogador"),
    F = filhote("jogador"),
    lobos = econ.lobos || [],
    aviso = (txt: string) => {
      pushEvent(txt);
      try {
        mvToast(txt);
      } catch (_) {}
    };
  // v7.7: cada mãe tem um filhote só (teveFilhote), mesmo que ele fuja ou se perca
  const mae = A.find((L) => L.sexo === "F" && nivelVinculo(L) >= 4 && !L.teveFilhote),
    pai = A.find((L) => L.sexo === "M" && nivelVinculo(L) >= 4);
  if (!F && mae && pai) {
    mae.teveFilhote = true;
    lobos.push({
      sexo: Math.random() < 0.5 ? "M" : "F",
      pelagem: (Math.random() < 0.5 ? mae : pai).pelagem,
      vinculo: 0,
      dono: "jogador",
      desde: world.tick,
      filhote: true,
      prazo: world.tick + CASAL.prazoDias * CONFIG.DAY_MIN,
      pontos: 0,
    });
    aviso("🐺 Nasceu o seu filhote! Solte os pais em até " + CASAL.prazoDias + " dias (E na cerca)");
    return;
  }
  if (F && !F.semPais && !F.cresceuLobo && F.prazo != null && world.tick >= F.prazo && A.length) {
    F.cresceuLobo = true;
    aviso("🐺 O seu filhote cresceu vendo os pais: virou lobo, não cão");
  }
}

/** Solta os pais: saem de econ.lobos; no acampamento, rodeiam e fogem (ou fogem já, com pouco vínculo). */
function soltarPais(peloCacador: boolean, dono: LoboCercado["dono"] = "cacador") {
  const A = adultos(dono);
  if (!A.length) return;
  const R = cercadoRet();
  if (R && !peloCacador) {
    CC.auto = PORTA.auto; // a porteira abre para eles saírem (sem soltar os outros)
    for (const L of A) CC.soltos.push(saida(L, R));
  }
  econ.lobos = (econ.lobos || []).filter((L) => !A.includes(L));
  const f = filhote(dono);
  if (f) f.paisSoltosEm = world.tick; // v7.7: passo 5a — daqui a FILHOTE.soltoDias ele começa a sair do cercado
  if (f && dono === "jogador") f.semPais = true; // v7.7 (5b): a tempo — ele cresce longe dos pais
  if (R && !peloCacador) {
    const txt = dono === "jogador" ? "Os pais foram embora · o seu filhote fica" : FALAS_CURTAS.paisSoltos;
    spawnDungeonToast("🐺 " + txt, dungeon.px, dungeon.py - 46, "#ffe08a", 13);
    sfx("perfect");
  }
  if (dono === "cacador") campanhaEvento("paisSoltos");
}

/** Os pais soltos no acampamento: rodeiam a fogueira e depois correm para fora pela esquerda. */
function soltosGL(dt: number) {
  const F = CPS.fire;
  if (!F || !CC.soltos.length) return;
  const T = dungeon.tile;
  for (const s of CC.soltos) {
    let tx: number, ty: number, vel: number;
    if (s.rota.length) {
      // primeiro, pela porteira
      tx = s.rota[0].x;
      ty = s.rota[0].y;
      vel = LOBO_C.velFoge;
      if (Math.hypot(tx - s.x, ty - s.y) < T * 0.25) s.rota.shift();
      if (!s.rota.length && s.rodeia > 0) s.ang = Math.atan2(s.y - F.y, s.x - F.x);
    } else if (s.ataca) {
      // v7.7 (5b): pouco vínculo — vai até ela e morde uma vez; depois foge
      const d = dungeon;
      tx = d.px;
      ty = d.py;
      vel = CASAL.velFuga;
      if (Math.hypot(d.px - s.x, d.py - s.y) < SOLTAR.alcance * T) {
        s.ataca = false;
        s.rodeia = 0;
        d.hp = Math.max(1, d.hp - SOLTAR.dano);
        spawnDungeonToast("😡 O lobo te mordeu! −" + SOLTAR.dano, d.px, d.py - 50, "#ff7a5a", 14);
        shakeScreen(0.2, 4);
        sfx("guardbreak");
      }
    } else if (s.rodeia > 0) {
      s.rodeia -= dt;
      s.ang += dt * 0.6;
      tx = F.x + Math.cos(s.ang) * CASAL.raio * T;
      ty = F.y + Math.sin(s.ang) * CASAL.raio * T * 0.8;
      vel = LOBO_C.vel * 1.6;
    } else {
      tx = -T * 3;
      ty = s.y;
      vel = CASAL.velFuga;
    }
    const ax = tx - s.x,
      ay = ty - s.y,
      q = Math.hypot(ax, ay);
    if (q > 1) {
      const p = Math.min(q, vel * dt);
      s.x += (ax / q) * p;
      s.y += (ay / q) * p;
      s.yaw = Math.atan2(ay, ax);
    }
    const ma = bichoAnimado(s, "lobo", s.x, s.y, { tom: tomPelagem(s.pelagem % 6) });
    if (ma) glPush(ma, M4.ch(M4.T(s.x, 0, s.y), M4.RY(-s.yaw), M4.S(s.escala || LOBO_C.escala)));
  }
  CC.soltos = CC.soltos.filter((s) => s.x > -T * 2.5);
}

/** Está perto da cerca (para o E e o painel). */
function pertoDoCercado() {
  const R = cercadoRet();
  if (!R) return false;
  const d = dungeon,
    p = d.tile * CERCADO.perto;
  return Math.abs(d.px - R.x) < R.w + p && Math.abs(d.py - R.y) < R.h + p;
}

/* ---------- passo 5a: o filhote do Caçador solto pelo acampamento ---------- */
function carnesNaMochila() {
  const h = dungeon.hero;
  if (!h) return 0;
  let n = 0;
  for (const inv of [ensureInv(h), qvInv(h)])
    for (const it of inv.items) if (CARNES.includes(it.def.key)) n += it.n || 1;
  return n;
}
/** Entrou no acampamento: o filhote (com os pais já soltos há FILHOTE.soltoDias) pode estar solto nesta visita. */
function novaVisita() {
  CC.livre = null;
  CC.bichos = []; // v7.7: a coleira também acaba (saiu do acampamento = ele voltou ao cercado)
  CC.rastro = [];
  CC.alimentar = null;
  fecharMenuLobo();
  // a porteira começa fechada (o Caçador fecha quando você sai) e você chega de fora
  CC.aberta = false;
  CC.auto = 0;
  CC.folha = 0;
  CC.dentro = false;
  const f = filhote(),
    H = CPS.hunter;
  if (!f || adultos().length || f.paisSoltosEm == null || !H) return;
  if (world.tick - f.paisSoltosEm < FILHOTE.soltoDias * CONFIG.DAY_MIN || Math.random() >= FILHOTE.chance) return;
  const T = dungeon.tile;
  CC.livre = { L: f, x: H.x + T, y: H.y + T * 0.6, yaw: 0, alvo: null, t: 0, seguindo: false };
}
/** O filhote solto: brinca perto do Caçador; com carne na mochila (FILHOTE.carneMin) e você por perto, vem atrás. */
function filhoteLivreGL(dt: number) {
  const P = CC.livre,
    H = CPS.hunter;
  if (!P || !H) return;
  const d = dungeon,
    T = d.tile,
    dist = Math.hypot(d.px - P.x, d.py - P.y),
    cheiro = carnesNaMochila() >= FILHOTE.carneMin && dist < FILHOTE.cheiro * T;
  if (cheiro && !P.seguindo) {
    spawnDungeonToast("🐾 O filhote sentiu o cheiro da carne", P.x, P.y - 30, "#ffe08a", 12);
    sfx("near");
  }
  P.seguindo = cheiro;
  let vel = FILHOTE.vel;
  if (P.seguindo) {
    // fica um pouco atrás de você
    const a = Math.atan2(P.y - d.py, P.x - d.px);
    P.alvo = { x: d.px + Math.cos(a) * FILHOTE.perto * T, y: d.py + Math.sin(a) * FILHOTE.perto * T };
    if (dist > FILHOTE.perto * T * 2) vel = FILHOTE.corre;
  } else if (!P.alvo || (P.t -= dt) <= 0) {
    P.t = 1.5 + Math.random() * 3;
    const a = Math.random() * Math.PI * 2,
      r = (0.6 + Math.random() * 0.4) * FILHOTE.rodaCacador * T;
    P.alvo = { x: H.x + Math.cos(a) * r, y: H.y + Math.sin(a) * r };
  }
  const ax = P.alvo.x - P.x,
    ay = P.alvo.y - P.y,
    q = Math.hypot(ax, ay);
  if (q > 3) {
    const s = Math.min(q, vel * dt);
    P.x += (ax / q) * s;
    P.y += (ay / q) * s;
    P.yaw = Math.atan2(ay, ax);
  } else if (P.seguindo) P.yaw = Math.atan2(d.py - P.y, d.px - P.x);
  const ma = bichoAnimado(P, "lobo", P.x, P.y, { tom: tomPelagem(P.L.pelagem % 6) });
  if (ma) glPush(ma, M4.ch(M4.T(P.x, 0, P.y), M4.RY(-P.yaw), M4.S(LOBO_C.filhote)));
}
function pertoDoFilhoteLivre() {
  const P = CC.livre,
    d = dungeon;
  return !!(P && d.active && d.camp && Math.hypot(d.px - P.x, d.py - P.y) < FILHOTE.perto * d.tile * 1.6);
}

/* ---------- v7.7 — GameShark (ui/gameshark.ts): atalhos para testar os lobos ---------- */
/** Um código do GameShark para os lobos; devolve a mensagem. */
export function gsLobos(cod: "LOBO" | "MEULOBO" | "LOBOVINCULO" | "LOBOMAX" | "LOBOVOLTA" | "FILHOTE"): string {
  const lobos = (econ.lobos ||= []),
    novo = (sexo: "M" | "F", pontos = 0, dono: LoboCercado["dono"] = "cacador"): LoboCercado => ({
      sexo,
      pelagem: Math.floor(Math.random() * 6),
      vinculo: 0,
      dono,
      desde: world.tick,
      pontos,
      diaCacador: dia(),
    });
  if (cod === "LOBO" || cod === "MEULOBO") {
    const dono = cod === "MEULOBO" ? "jogador" : "cacador",
      A = adultos(dono),
      sexo = A.length && A[0].sexo === "M" ? "F" : "M";
    lobos.push(novo(sexo, 0, dono));
    return (sexo === "M" ? "Um lobo" : "Uma loba") + (dono === "jogador" ? " seu" : " do Caçador") + " no cercado";
  }
  if (cod === "LOBOVOLTA") {
    const n = (econ.lobosFugidos || []).length;
    for (const f of econ.lobosFugidos || []) lobos.push(f.L);
    econ.lobosFugidos = [];
    return n ? n + " lobo(s) de volta ao cercado" : "Nenhum lobo fugido";
  }
  if (!lobos.length && cod !== "FILHOTE") return "O cercado está vazio (use LOBONOVO)";
  if (cod === "LOBOVINCULO" || cod === "LOBOMAX") {
    for (const L of lobos) {
      const n = cod === "LOBOMAX" ? VINCULO.niveis.length : Math.min(VINCULO.niveis.length, nivelVinculo(L) + 1);
      L.pontos = Math.max(L.pontos || 0, VINCULO.niveis[n - 1]);
      L.vinculo = nivelVinculo(L);
    }
    return lobos
      .map((L) => (L.filhote ? "filhote " : "") + (L.sexo === "M" ? "♂" : "♀") + " " + L.vinculo + "/4")
      .join(" · ");
  }
  // FILHOTE: o casal no vínculo 4 e o primeiro pedido dado como feito; o casalTick seguinte faz nascer
  if (filhote()) return "O filhote já nasceu";
  const max = VINCULO.niveis[VINCULO.niveis.length - 1];
  for (const sexo of ["M", "F"] as const) if (!adultos().some((L) => L.sexo === sexo)) lobos.push(novo(sexo, max));
  for (const L of adultos()) L.pontos = Math.max(L.pontos || 0, max);
  const C = campanha();
  C.flags.segundoLobo = true;
  if (C.feitas.a3_pedido == null) C.feitas.a3_pedido = world.tick;
  casalTick();
  return filhote() ? "Nasceu o filhote do Caçador!" : "O casal está pronto; o filhote nasce já";
}

/** A linha do painel de ações perto do cercado (ou do filhote solto). */
export function acaoCercado(): { texto: string; detalhe: string; tecla: boolean } | null {
  if (pertoDaPorta() && !pertoDoFilhoteLivre())
    return {
      texto: CC.aberta ? "Fechar a porteira" : "Abrir a porteira",
      detalhe: CC.aberta ? "lobo com vínculo abaixo de 2 foge" : CC.dentro ? "para sair" : "para entrar",
      tecla: true,
    };
  cacadorTrata();
  // v7.7: perto de um lobo, o E abre o menu dele (afagar, dar comida, conduzir, soltar)
  const a = alvoLobo();
  if (!a) return null;
  return {
    texto: a.b && a.b.guiado ? "Lobo na coleira · opções" : "Lobo · opções",
    detalhe: descLobo(a.L),
    tecla: true,
  };
}

/** E no cercado: perto da porteira abre/fecha; perto de um lobo (ou da cerca, com lobo lá dentro) abre o menu dele. */
export function interagirCercado() {
  if (CC.menu) return true;
  if (pertoDaPorta() && !pertoDoFilhoteLivre()) {
    trocarPorta();
    return true;
  }
  return abrirMenuLobo();
}
/** Quantas comidas de lobo (COMIDA_LOBO) há na mochila e na aljava. */
function comidasNaMochila() {
  const h = dungeon.hero;
  if (!h) return 0;
  let n = 0;
  for (const inv of [ensureInv(h), qvInv(h)])
    for (const it of inv.items) if (COMIDA_LOBO[it.def.key] != null) n += it.n || 1;
  return n;
}
/** A comida `it` (de `inv`) para o lobo `L` (`onde` = onde ele está, para o aviso). */
function darComida(L: LoboCercado, onde: { x: number; y: number } | null, it: Item, inv: InvGrid) {
  const d = dungeon;
  if (!inv.items.includes(it) || COMIDA_LOBO[it.def.key] == null) return;
  if (L.comeuDia === dia()) {
    spawnDungeonToast("Ele já comeu hoje", d.px, d.py - 40, "#e8d6a8", 12);
    return;
  }
  if ((it.n || 1) > 1) it.n!--;
  else inv.items.splice(inv.items.indexOf(it), 1);
  const antes = nivelVinculo(L);
  L.comeuDia = dia();
  L.pontos = (L.pontos || 0) + COMIDA_LOBO[it.def.key];
  L.vinculo = nivelVinculo(L);
  spawnDungeonToast(
    L.vinculo > antes ? "🐺 Vínculo " + L.vinculo + "/4!" : "🐺 Comeu",
    onde ? onde.x : d.px,
    (onde ? onde.y : d.py) - 40,
    "#ffe08a",
    13,
  );
  sfx(L.vinculo > antes ? "perfect" : "swing");
  campanhaEvento("loboAlimentado");
}
