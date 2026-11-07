/* ==== v8.0 — mundo ligado (ROADMAP, decisão do mantenedor 2026-10-23: o campo é um pedaço do mapa) ====
   Passo 1: o campo que se abre pelo mapa (dungeon.mode "campo", map/transicao.ts) é o pedaço do mapa em volta de onde
   a heroína estava; cada passo no campo move a heroína no mapa na hora (h.x/h.y e JOGO.pos, que exitDungeon usa para
   devolvê-la onde ela está). Escala (MUNDO.escala): a VISTA (21 × 13 casas de 42, o tamanho da arena antiga) cobre
   mais ou menos o que o mapa mostra no zoom máximo, então o mergulho do mapa para o campo mostra o mesmo pedaço.
   Passos 2 e 3 (mantenedor: "ainda é aquela telinha"; "floresta cheia de árvore, do lado de um rio coloca um rio"):
   o campo aberto é uma janela de MUNDO.pedacos × a vista que acompanha a heroína: quando ela se afasta do meio
   (MUNDO.desliza casas), a janela desliza (deslocar: a origem anda e tudo o que está no campo volta o mesmo tanto),
   sem corte. O cenário (render/gl/mundo_cena.ts) vem do mapa em blocos presos ao lugar do mundo, então não muda ao
   deslizar. Água do mapa não se anda (mundoMover), troncos de árvore barram. O acampamento, a sala de treino e as
   expedições do preparo continuam arenas soltas (sem origem). */
import { dungeon, world, TELAS } from "../core/state.ts";
import { JOGO } from "../ui/modos.ts";
import { snapToLand, spawnAnimal, killAnimal } from "../sim/animais.ts";
import { aguaEm } from "./terreno.ts";
import { D3 } from "../field/projecao.ts";
import { critSpawn, loboNeutro } from "../field/campo_vida.ts";
import { spawnJavalino } from "../creatures/javali.ts";
import { vilaMover } from "./vila_cena.ts";
import { killWild } from "../sim/fauna.ts";
import type { Animal, Hero, Monster, Ponto, Wild } from "../core/tipos.ts";

/** escala: unidades do mapa por unidade do campo (px de campo; uma casa = 42); vista: casas que a câmera mostra (a arena
 *  antiga); pedacos: a janela tem tantas vistas de lado; desliza: casas fora do meio para a janela deslizar; perto:
 *  raio (casas) em volta dela onde nascem bichos e itens; bloco: casas de cada bloco de cenário (mundo_cena.ts);
 *  raioHeroi: o corpo dela contra a água e os troncos (casas). */
export const MUNDO = {
  escala: 0.155,
  vista: { cols: 21, rows: 13 },
  pedacos: 3,
  desliza: 9,
  perto: 15,
  bloco: 6,
  raioHeroi: 0.28,
};

/** Troncos e pedras grandes de cada bloco de cenário (posições do campo absolutas = mapa / escala; x, z, raio). */
const OBST = new Map<string, number[]>();
export function registrarObstaculos(chave: string, lista: number[] | null) {
  if (lista) OBST.set(chave, lista);
  else OBST.delete(chave);
}

/** O canto da janela em coordenadas absolutas do campo (mapa / escala); null fora do campo aberto. */
export function cantoCampo() {
  const o = dungeon.origem;
  return o ? { x: o.x / MUNDO.escala, y: o.y / MUNDO.escala } : null;
}

/** Abre o campo no pedaço do mapa em volta de `h`: a janela grande, a heroína (e a entrada) no meio. */
export function mundoEntrar(h: Hero) {
  const d = dungeon,
    T = d.tile;
  d.cols = MUNDO.vista.cols * MUNDO.pedacos;
  d.rows = MUNDO.vista.rows * MUNDO.pedacos;
  const cx = (d.cols * T) / 2,
    cy = (d.rows * T) / 2,
    P = JOGO.pos || { x: h.x, y: h.y };
  // o canto alinhado à grade de casas do mundo (o chão e os blocos de cenário ficam no lugar ao deslizar)
  const ax = Math.round((P.x / MUNDO.escala - cx) / T) * T,
    ay = Math.round((P.y / MUNDO.escala - cy) / T) * T;
  d.origem = { x: ax * MUNDO.escala, y: ay * MUNDO.escala };
  d.px = P.x / MUNDO.escala - ax;
  d.py = P.y / MUNDO.escala - ay;
  d.entrance = { x: d.px, y: d.py };
  BICHOS.t = 0;
}

/** O tamanho (px do campo) que a câmera enquadra: a vista no campo aberto, a arena inteira nos outros. */
export function vistaCampo() {
  const d = dungeon,
    T = d.tile;
  return d.origem ? { W: MUNDO.vista.cols * T, H: MUNDO.vista.rows * T } : { W: d.cols * T, H: d.rows * T };
}

/** Um ponto do campo no mapa (sem origem, null). */
function campoNoMapa(x: number, y: number) {
  const o = dungeon.origem;
  if (!o) return null;
  const W = TELAS.worldW || Infinity,
    H = TELAS.worldH || Infinity;
  return {
    x: Math.max(0, Math.min(W, o.x + x * MUNDO.escala)),
    y: Math.max(0, Math.min(H, o.y + y * MUNDO.escala)),
  };
}

/** Água do mapa no ponto (x, y) do campo (só no campo aberto). */
function aguaNoCampo(x: number, y: number) {
  const o = dungeon.origem;
  return !!o && aguaEm(o.x + x * MUNDO.escala, o.y + y * MUNDO.escala);
}

/** Algo barra o ponto (x, y) do campo para um corpo de raio r: água ou tronco. */
export function barrado(x: number, y: number, r: number) {
  if (aguaNoCampo(x, y)) return true;
  const c = cantoCampo()!,
    ax = x + c.x,
    ay = y + c.y,
    B = MUNDO.bloco * dungeon.tile,
    bi = Math.floor(ax / B),
    bj = Math.floor(ay / B);
  for (let i = bi - 1; i <= bi + 1; i++)
    for (let j = bj - 1; j <= bj + 1; j++) {
      const L = OBST.get(i + "," + j);
      if (!L) continue;
      for (let k = 0; k < L.length; k += 3) if (Math.hypot(L[k] - ax, L[k + 1] - ay) < L[k + 2] + r) return true;
    }
  return false;
}

/** v8.1 — o caminho reto de (x0, y0) até (x1, y1) está livre de água e tronco para um corpo de raio `raio` casas
    (o javali só mira com o caminho livre). Fora do campo aberto, sempre livre. */
export function linhaLivre(x0: number, y0: number, x1: number, y1: number, raio = 0.3) {
  if (!dungeon.origem || dungeon.vila) return true;
  const T = dungeon.tile,
    n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (T * 0.33)));
  for (let i = 1; i < n; i++) if (barrado(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, raio * T)) return false;
  return true;
}

/** Para onde a heroína (ou um bicho, de raio `raio` casas) pode ir de (x0, y0) querendo (x1, y1): sem entrar na água
    nem atravessar tronco; escorrega ao longo do que barra (tenta cada eixo). Fora do campo aberto, (x1, y1). */
export function mundoMover(x0: number, y0: number, x1: number, y1: number, raio = MUNDO.raioHeroi): [number, number] {
  if (dungeon.vila) return vilaMover(x0, y0, x1, y1, raio * dungeon.tile); // v8.0: casas, poço e água da vila
  if (!dungeon.origem) return [x1, y1];
  const r = raio * dungeon.tile;
  if (!barrado(x1, y1, r)) return [x1, y1];
  if (!barrado(x1, y0, r)) return [x1, y0];
  if (!barrado(x0, y1, r)) return [x0, y1];
  return barrado(x0, y0, r) ? [x1, y1] : [x0, y0]; // já presa (nasceu na beira): deixa sair
}

/** Um ponto livre (terra, sem tronco) a até `ate` casas da heroína (MUNDO.perto) e longe dela pelo menos `longe`
    casas, dentro da janela; null se não achar (ou fora do campo aberto). Para bichos e itens nascerem onde ela anda. */
export function pontoPerto(longe = 0, ate = MUNDO.perto) {
  const d = dungeon,
    T = d.tile;
  if (!d.origem) return null;
  for (let n = 0; n < 40; n++) {
    const a = Math.random() * Math.PI * 2,
      r = (longe + Math.random() * (ate - longe)) * T,
      x = Math.max(T * 1.5, Math.min(d.cols * T - T * 1.5, d.px + Math.cos(a) * r)),
      y = Math.max(T * 1.5, Math.min(d.rows * T - T * 1.5, d.py + Math.sin(a) * r));
    if (Math.hypot(x - d.px, y - d.py) < longe * T || barrado(x, y, T * 0.3)) continue;
    return { x, y };
  }
  return null;
}

/* ---------- a janela desliza ---------- */
/** Listas do campo com coisas que têm posição; e os campos soltos com um ponto. */
const LISTAS = [
  "monsters",
  "toasts",
  "arrows",
  "birds",
  "bushes",
  "cuts",
  "fires",
  "fx",
  "ghosts",
  "loot",
  "parts",
  "rings",
  "runes",
  "sparks",
  "spears",
  "pegadas",
  "fezes",
  "sangue",
] as const;
const SOLTOS = ["moveTarget", "entrance", "mount", "mouse", "slash", "crav", "finish", "hv", "spCh", "rope"] as const;
/** Pares de números que são posição (o resto, como vx/vy ou dx/dy, é direção ou velocidade). */
const PARES = [
  ["x", "y"],
  ["tx", "ty"],
  ["lx", "ly"],
  ["x0", "y0"],
  ["x1", "y1"],
] as const;
/** Chaves que nunca são seguidas (itens têm x, y da grade da mochila; o herói tem x, y do mapa). */
const NAO = new Set(["it", "item", "def", "inv", "items", "hero", "equip", "conteudo", "bichoMapa"]);

/** Tira (sx, sy) de tudo o que está no campo (a origem anda o mesmo tanto, então nada muda de lugar no mundo). */
function deslocar(sx: number, sy: number) {
  const d = dungeon,
    vistos = new WeakSet<object>();
  if (d.hero) vistos.add(d.hero);
  const mover = (o: unknown, fundo: number) => {
    if (!o || typeof o !== "object" || vistos.has(o) || ArrayBuffer.isView(o)) return;
    if (typeof Node !== "undefined" && o instanceof Node) return;
    vistos.add(o);
    const r = o as Record<string, unknown>;
    for (const [a, b] of PARES)
      if (typeof r[a] === "number" && typeof r[b] === "number") {
        (r[a] as number) -= sx;
        (r[b] as number) -= sy;
      }
    if (fundo >= 1) return; // um nível para dentro: alvo, toca, destino… (não a ficha inteira do bicho)
    for (const k of Object.keys(r))
      if (!NAO.has(k) && r[k] && typeof r[k] === "object" && !Array.isArray(r[k])) mover(r[k], fundo + 1);
  };
  for (const k of LISTAS) for (const e of (d[k] as unknown[] | undefined) || []) mover(e, 0);
  for (const k of SOLTOS) mover(d[k], 0);
  d.px -= sx;
  d.py -= sy;
  D3.cx -= sx;
  D3.cz -= sy;
  d.origem = { x: d.origem!.x + sx * MUNDO.escala, y: d.origem!.y + sy * MUNDO.escala };
  // o que ficou fora da janela vai embora (menos o que importa: o alvo, o foco, a presa da caçada, o que está preso)
  const T = d.tile,
    W = d.cols * T,
    H = d.rows * T,
    dentro = (p: Ponto) => p.x > -T && p.y > -T && p.x < W + T && p.y < H + T;
  d.monsters = d.monsters.filter((m) => dentro(m) || m === d.target || m === d.foco || !!m.cacada || !!m.bound);
  for (const k of ["loot", "toasts", "rings", "fx", "parts", "sparks", "cuts", "ghosts"] as const) {
    const L = d[k] as Ponto[] | undefined;
    if (L) (d as unknown as Record<string, Ponto[]>)[k] = L.filter(dentro);
  }
}

/** A cada quadro do campo: a heroína e os bichos andam no mapa junto (updateDungeonFlow chama); longe do meio, a
    janela desliza. */
export function mundoTick(dt: number) {
  const d = dungeon,
    h = d.hero;
  if (!d.active || d.mode !== "campo" || !d.origem) return;
  const T = d.tile,
    W = d.cols * T,
    H = d.rows * T,
    lim = MUNDO.desliza * T;
  if (Math.abs(d.px - W / 2) > lim || Math.abs(d.py - H / 2) > lim)
    deslocar(Math.round((d.px - W / 2) / T) * T, Math.round((d.py - H / 2) / T) * T);
  if (dt > 0) bichosTick(dt);
  if (!h || !world.heroes.includes(h)) return;
  const p = campoNoMapa(d.px, d.py);
  if (!p) return;
  h.x = p.x;
  h.y = p.y;
  JOGO.pos = p;
}

/** Onde devolver a heroína no mapa ao sair (fora da água). */
export function mundoSaida(P: { x: number; y: number }) {
  bichosSoltar();
  return dungeon.origem ? snapToLand(P.x, P.y) : P;
}

/* ---------- passo 4: os bichos do mapa são os do campo ----------
   Coelhos, cervos, lobos e (v8.0) javalis do mapa que estão dentro da janela entram no campo onde estão no mapa, ligados ao bicho do
   mapa (m.bichoMapa). Enquanto ligado, a simulação do mapa não move o bicho (BICHOS.presos, sim/motor.ts) e o campo
   escreve a posição dele no mapa. Derrubado no campo, morre no mapa; saiu da janela ou fugiu, volta a viver no mapa.
   Os bichos que nascem no campo aberto nascem também no mapa (bichoNovo).
   v8.1: as raposas do mapa (world.wild, sim/fauna.ts) também entram (até BICHOS.raposas); presas, o mapa não as
   move nem as faz fugir da heroína. */
export const BICHOS = {
  especies: ["rabbit", "deer", "wolf", "boar"],
  max: 8, // coelhos e cervos ligados ao mesmo tempo
  lobos: 1,
  javalis: 2, // v8.0: javalis do mapa no campo (o javalino da investida, creatures/javali.ts)
  raposas: 2, // v8.1
  cada: 0.5, // s entre uma procura e outra
  presos: new Map<Animal | Wild, Monster>(),
  t: 0,
};

/** Liga o bicho do campo `m` ao bicho do mapa `a` (no campo aberto). */
export function ligarBicho(m: Monster, a: Animal | Wild) {
  if (!dungeon.origem || a.alive === false) return;
  m.bichoMapa = a;
  m.sex = a.sex;
  BICHOS.presos.set(a, m);
}

/** Todos os bichos do mapa voltam a viver no mapa (saiu do campo, ou outro campo abriu). */
export function bichosSoltar() {
  BICHOS.presos.clear();
}

/** Um bicho do mapa que entra no campo em (x, y). */
function entrarBicho(a: Animal | Wild, x: number, y: number) {
  const m = a.species === "wolf" ? loboNeutro() : a.species === "boar" ? spawnJavalino(1) : critSpawn(a.species);
  if (a.species === "boar") m.name = "Javali";
  m.x = x;
  m.y = y;
  ligarBicho(m, a);
}

/** Um bicho novo no campo aberto (repovoar): nasce no mapa também, perto dela e chegando de longe. */
export function bichoNovo(sp: string) {
  const p = pontoPerto(11),
    o = dungeon.origem;
  if (!p || !o) return;
  entrarBicho(spawnAnimal(sp, o.x + p.x * MUNDO.escala, o.y + p.y * MUNDO.escala, 1), p.x, p.y);
}

/** A cada quadro do campo aberto: a posição dos ligados vai para o mapa; os que saíram, voltam; os de perto, entram. */
function bichosTick(dt: number) {
  const d = dungeon,
    o = d.origem!,
    e = MUNDO.escala,
    T = d.tile,
    ligados = new Set<Animal | Wild>();
  let lobos = 0,
    javalis = 0,
    raposas = 0,
    mortos = false;
  for (const m of d.monsters) {
    const a = m.bichoMapa;
    if (!a || !m.alive) continue;
    if (a.alive === false) {
      // morreu no mapa por outro caminho (uma runa, outra heroína caçando): sai do campo
      mortos = true;
      continue;
    }
    a.x = o.x + m.x * e;
    a.y = o.y + m.y * e;
    if (m.ang != null) a.dir = m.ang;
    ligados.add(a);
    if (a.species === "wolf") lobos++;
    else if (a.species === "boar") javalis++;
    else if (a.species === "fox") raposas++;
  }
  if (mortos) d.monsters = d.monsters.filter((m) => !m.bichoMapa || m.bichoMapa.alive !== false);
  for (const [a, m] of BICHOS.presos)
    if (!ligados.has(a)) {
      BICHOS.presos.delete(a);
      // derrubado no campo (pela heroína ou pelo lobo) = morre no mapa; fugiu ou saiu da janela = segue vivo lá
      if (m.hp! <= 0 && a.alive !== false) {
        if (a.species === "fox") killWild(a as Wild, "caçada no campo");
        else killAnimal(a as Animal, "caçado no campo");
      }
    }
  BICHOS.t -= dt;
  if (BICHOS.t > 0) return;
  BICHOS.t = BICHOS.cada;
  let n = ligados.size - lobos - javalis - raposas;
  if (n >= BICHOS.max && lobos >= BICHOS.lobos && javalis >= BICHOS.javalis && raposas >= BICHOS.raposas) return;
  const W = d.cols * T,
    H = d.rows * T,
    m0 = T * 1.5,
    perto: [number, Animal | Wild, number, number][] = [];
  const olhar = (a: Animal | Wild) => {
    const x = (a.x - o.x) / e,
      y = (a.y - o.y) / e;
    if (x < m0 || y < m0 || x > W - m0 || y > H - m0 || barrado(x, y, T * 0.3)) return;
    perto.push([Math.hypot(x - d.px, y - d.py), a, x, y]);
  };
  for (const a of world.animals)
    if (a.alive && !a.runic && !BICHOS.presos.has(a) && BICHOS.especies.includes(a.species)) olhar(a);
  for (const w of world.wild || []) if (w.alive && w.species === "fox" && !BICHOS.presos.has(w)) olhar(w);
  perto.sort((p, q) => p[0] - q[0]);
  for (const [, a, x, y] of perto) {
    const lobo = a.species === "wolf",
      javali = a.species === "boar",
      raposa = a.species === "fox";
    if (
      lobo
        ? lobos >= BICHOS.lobos
        : javali
          ? javalis >= BICHOS.javalis
          : raposa
            ? raposas >= BICHOS.raposas
            : n >= BICHOS.max
    )
      continue;
    if (lobo) lobos++;
    else if (javali) javalis++;
    else if (raposa) raposas++;
    else n++;
    entrarBicho(a, x, y);
  }
}
