/* ==== v8.0 — a caminhada do fim da cena inicial até o acampamento (ROADMAP "Saída da intro em jogo"; mantenedor,
   2026-10-23: "faz o jogador ter que andar pra cima, ver alguns bichos, achar loot no chão, flechas, comidas… chegando
   na área do acampamento sai do modo dentro do jogo, mostra onde o jogador tava, anda até onde é o acampamento e dá o
   zoom de novo pra entrar") ====
   Ao sair da cena inicial a tela escurece e ela já está no campo aberto (map/mundo.ts), ISC_CAMINHO.dist ao sul do
   acampamento, num caminho sem água. Pelo caminho: bichos que nascem no mapa (e entram no campo como todos) e flechas
   e comida no chão (postos quando o pedaço entra na janela). Sair antes pela roda também vale: no mapa o tutorial de
   sempre aponta o acampamento.
   v8.1 (mantenedor, 2026-10-30: "mais interessante tendo inimigos, um lobo; dá pra ver o acampamento chegando"): no
   meio do caminho um uivo, e um lobo passa a segui-la de lado (Monster.espreita, field/campo_vida.ts loboAI); mais
   adiante ele ataca. Ele desiste com a vida dela baixa ou perto do fogo (o fogo do acampamento afasta lobos). Perto da
   base o acampamento aparece no próprio campo aberto (field/acampamento_campo.ts), com a fumaça vista de longe, e ela
   entra pela fogueira, sem subir ao mapa. */
import { dungeon, world } from "../core/state.ts";
import { ISC_CAMINHO } from "../data/intro.ts";
import { ACAMP_CAMPO } from "../data/campo.ts";
import { MUNDO, pontoPerto } from "../map/mundo.ts";
import { aguaEm, terrenoPronto } from "../map/terreno.ts";
import { campoDireto } from "../map/transicao.ts";
import { spawnAnimal } from "../sim/animais.ts";
import { loboBravo, loboNeutro } from "../field/campo_vida.ts";
import { setBanner, spawnDungeonToast } from "../field/masmorra.ts";
import { distFogueira } from "../field/acampamento_campo.ts";
import { cineSfx } from "../audio/som.ts";
import { introObj } from "./cena.ts";
import type { Hero, Monster, Ponto } from "../core/tipos.ts";

/** on: a caminhada está valendo; itens: o que ainda vai para o chão (posições do mapa); lobo: o do caminho (v8.1). */
const CAM = {
  on: false,
  h: null as Hero | null,
  camp: null as Ponto | null,
  itens: [] as { key: string; x: number; y: number }[],
  txt: "",
  lobo: null as Monster | null,
  dica: "",
};

/** Uma casa do campo em unidades do mapa. */
const casa = () => MUNDO.escala * dungeon.tile;

/** Sem água no caminho reto de (x0, y0) até perto de (x1, y1). */
function semAgua(x0: number, y0: number, x1: number, y1: number) {
  for (let i = 0; i <= 24; i++) {
    const t = (i / 24) * 0.92;
    if (aguaEm(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
  }
  return true;
}

/** Onde ela começa: ISC_CAMINHO.dist ao sul da base, o mais perto do sul que tenha caminho seco. */
function inicio(c: Ponto): Ponto {
  const C = ISC_CAMINHO;
  for (let k = 0; k <= 12; k++) {
    const a = Math.PI / 2 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (C.leque / 12),
      x = c.x + Math.cos(a) * C.dist,
      y = c.y + Math.sin(a) * C.dist;
    if (semAgua(x, y, c.x, c.y)) return { x, y };
  }
  return { x: c.x + 6, y: c.y + C.dist * 0.6 };
}

/** Um ponto do caminho (fração t de p0 até a base), afastado `lado` casas para um lado. */
function noCaminho(p0: Ponto, c: Ponto, t: number, lado: number): Ponto {
  const dx = c.x - p0.x,
    dy = c.y - p0.y,
    L = Math.hypot(dx, dy) || 1,
    k = lado * casa();
  return { x: p0.x + dx * t + (-dy / L) * k, y: p0.y + dy * t + (dx / L) * k };
}

/** introToMap: começa a caminhada. false = não deu (sem acampamento ou sem o mapa pronto): o caminho antigo. */
export function caminhadaIni(h: Hero) {
  if (!h || !h.camp || !world.heroes.includes(h) || !terrenoPronto()) return false;
  const C = ISC_CAMINHO,
    c = { x: h.camp.x, y: h.camp.y },
    p0 = inicio(c);
  CAM.on = true;
  CAM.h = h;
  CAM.camp = c;
  CAM.txt = "";
  CAM.lobo = null;
  // itens espalhados pelo caminho, alternando os lados
  const chaves = C.itens.flatMap(([k, n]) => Array.from({ length: n }, () => k)).sort(() => Math.random() - 0.5);
  CAM.itens = chaves.map((key, i) => {
    const t = 0.12 + (0.7 * (i + 0.5)) / chaves.length,
      p = noCaminho(p0, c, t, (i % 2 ? 1 : -1) * C.lado * (0.4 + Math.random() * 0.6));
    return { key, ...p };
  });
  // bichos do mapa pelo caminho (entram no campo quando a janela chega neles)
  C.bichos.forEach((sp, i) => {
    const p = noCaminho(p0, c, 0.25 + (0.5 * i) / Math.max(1, C.bichos.length - 1), (i % 2 ? -1 : 1) * C.lado * 2);
    if (!aguaEm(p.x, p.y)) spawnAnimal(sp, p.x, p.y, 1);
  });
  campoDireto(h, p0, () => {
    dungeon.banner = null; // o objetivo no alto já diz para onde ir
  });
  return true;
}

/** O objetivo no alto da tela (a caixa da cena inicial, #isc-obj; criada se ainda não existe). */
function objetivo(t: string, s: string) {
  const v = document.getElementById("dungeon-view");
  if (t && v && !document.getElementById("isc-obj")) {
    const e = document.createElement("div");
    e.id = "isc-obj";
    e.innerHTML = "<b></b><small></small>";
    v.appendChild(e);
  }
  introObj(t, s);
}

/** Tique do campo (updateDungeonFlow): põe os itens que entraram na janela, mostra a distância e cuida do lobo. */
export function caminhadaTick() {
  const d = dungeon,
    h = CAM.h,
    o = d.origem;
  if (!CAM.on || !h || !CAM.camp) return;
  if (!d.active || d.hero !== h || !o) {
    // saiu por conta própria (o tutorial do mapa segue) ou chegou: entrou no acampamento
    if (!d.active || d.camp) CAM.on = false;
    return;
  }
  const e = MUNDO.escala,
    T = d.tile;
  CAM.itens = CAM.itens.filter((p) => {
    const x = (p.x - o.x) / e,
      y = (p.y - o.y) / e;
    if (x < T || y < T || x > d.cols * T - T || y > d.rows * T - T) return true;
    d.loot = d.loot || [];
    d.loot.push({ key: p.key, x, y, ground: true, t: 0, ttl: 0 });
    return false;
  });
  const dist = Math.hypot(h.x - CAM.camp.x, h.y - CAM.camp.y),
    andado = 1 - dist / ISC_CAMINHO.dist;
  loboTick(andado);
  // v8.1: perto da base ela já vê o acampamento no campo aberto (field/acampamento_campo.ts) e entra pela fogueira
  const passos = Math.max(0, Math.round((distFogueira() - ACAMP_CAMPO.entrada * T) / T)),
    txt = passos
      ? "⛺ a " + passos + " passos, ao norte · " + (CAM.lobo?.alive ? CAM.dica : "siga a fumaça")
      : "⛺ chegue até a fogueira";
  if (txt !== CAM.txt) {
    CAM.txt = txt;
    objetivo("🌲 Vá até o acampamento do Caçador", txt);
  }
}

/** v8.1 — o lobo do caminho: o uivo, ele seguindo de lado, o ataque e a desistência (vida baixa ou o fogo). */
function loboTick(andado: number) {
  const d = dungeon,
    T = d.tile,
    L = ISC_CAMINHO.lobo;
  if (!CAM.lobo) {
    if (andado < L.uiva) return;
    const p = pontoPerto(L.espreita, L.espreita + 2);
    if (!p) return;
    const m = loboNeutro();
    m.x = p.x;
    m.y = p.y;
    m.espreita = L.espreita * T;
    CAM.lobo = m;
    CAM.dica = "algo te segue na mata";
    cineSfx("uivo");
    setBanner("🐺 Um uivo na mata…", "um lobo está te seguindo · fique de olho", 3.5, "#ffb37a");
    return;
  }
  const m = CAM.lobo;
  if (!m.alive || m.fugir) return;
  if (m.espreita && !m.neutral) m.espreita = undefined; // ela atacou primeiro: ele já está bravo
  const pertoDoFogo = distFogueira() < (ACAMP_CAMPO.clareira + ACAMP_CAMPO.fogoAfasta) * T;
  if (m.espreita && (andado >= L.ataca || pertoDoFogo)) {
    m.espreita = undefined;
    if (pertoDoFogo) {
      m.fugir = true; // chegou ao fogo antes do ataque: ele desiste
      return;
    }
    loboBravo(m);
    CAM.dica = "lute ou corra para o fogo";
    setBanner("🐺 O lobo atacou!", "lute, ou corra para o acampamento: lobo tem medo de fogo", 3.5, "#ff9a9a");
    return;
  }
  if (!m.neutral && (pertoDoFogo || d.hp < d.hpMax * L.fogeVida)) {
    m.neutral = true;
    m.fugir = true;
    d.target = d.target === m ? null : d.target;
    spawnDungeonToast(pertoDoFogo ? "🔥 o fogo afastou o lobo" : "🐺 o lobo recuou", m.x, m.y - 34, "#ffd08a", 13);
  }
}
