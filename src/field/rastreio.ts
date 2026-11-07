/* ==== v7.7 — rastreamento de criaturas (documento mestre, 2.4) ====
   Com o nó Rastreador (árvore Mundo), um painel compacto no canto superior direito lista até RASTREIO.cap[rank − 1]
   bichos dentro de RASTREIO.raio. Os próximos entram sozinhos; Ctrl + clique num bicho inclui ou tira à mão, e o ✕
   do painel tira. Cheio, outro só entra depois de tirar um (os de agora ficam). Quem sai do raio (ou morre) sai da
   lista. Os rastreados ganham uma marca laranja em cima. Não mexe no alvo prioritário nem no foco. */
import { dungeon } from "../core/state.ts";
import { RASTREIO } from "../data/combate.ts";
import { nodeRank } from "../hero/arvores.ts";
import { spawnDungeonToast } from "./masmorra.ts";
import type { Monster } from "../core/tipos.ts";

interface EstadoRastro {
  lista: Monster[];
  tirados: Set<Monster>; // tirados à mão: não voltam sozinhos enquanto estiverem no raio
  sess: number;
  el: HTMLElement | null;
  desenhado: number; // performance.now() do último redesenho do painel
  feitos: Monster[]; // a lista com que as linhas do painel foram montadas
  capFeito: number;
}
export const RASTRO: EstadoRastro = {
  lista: [],
  tirados: new Set(),
  sess: -1,
  el: null,
  desenhado: 0,
  feitos: [],
  capFeito: 0,
};

/** Quantos bichos cabem no rastreio (0 = sem o nó Rastreador). */
function rastreioCap() {
  const r = nodeRank(dungeon.hero, "rastreador");
  return r ? RASTREIO.cap[Math.min(r, RASTREIO.cap.length) - 1] : 0;
}
function dentro(m: Monster) {
  const d = dungeon;
  return m.alive && !m.dummy && Math.hypot(m.x - d.px, m.y - d.py) <= RASTREIO.raio * d.tile;
}

/** v7.7 — topo livre no canto superior direito do campo: abaixo do que estiver visível entre `ids` (barra do HUD, quadro
    do objetivo, painel do alvo). Usado pelo painel do alvo prioritário e pelo do rastreio. */
export function topoCanto(ids: string[]) {
  let topo = 64;
  for (const id of ids) {
    const o = document.getElementById(id);
    if (!o || o.style.display === "none" || (id === "missao" && !o.classList.contains("on"))) continue;
    const r = o.getBoundingClientRect();
    // só o que está no alto da tela empurra (a barra do HUD fica embaixo no computador e em cima no celular)
    if (r.height && r.top < innerHeight / 2) topo = Math.max(topo, r.bottom + 8);
  }
  return topo;
}
/** Ctrl + clique num bicho: inclui (se couber e estiver no raio) ou tira do rastreio. */
export function rastreioAlternar(m: Monster) {
  const d = dungeon,
    cap = rastreioCap();
  if (!cap) return;
  const i = RASTRO.lista.indexOf(m);
  if (i >= 0) {
    rastreioTirar(m);
    return;
  }
  if (!dentro(m)) spawnDungeonToast("Longe demais para rastrear", m.x, m.y - 36, "#ffb37a", 11);
  else if (RASTRO.lista.length >= cap)
    spawnDungeonToast("Rastreio cheio (" + cap + "): tire um antes", d.px, d.py - 40, "#ffb37a", 11);
  else {
    RASTRO.tirados.delete(m);
    RASTRO.lista.push(m);
    RASTRO.desenhado = 0;
  }
}
function rastreioTirar(m: Monster) {
  const i = RASTRO.lista.indexOf(m);
  if (i < 0) return;
  RASTRO.lista.splice(i, 1);
  RASTRO.tirados.add(m);
  RASTRO.desenhado = 0;
}

/** Atualiza a lista e o painel; roda a cada quadro do campo. */
export function rastreioTick() {
  const d = dungeon;
  if (RASTRO.sess !== d.sess) {
    RASTRO.lista = [];
    RASTRO.tirados.clear();
    RASTRO.sess = d.sess;
  }
  const cap = d.active && !d.dead ? rastreioCap() : 0;
  if (!cap) {
    RASTRO.lista = [];
    painel(0);
    return;
  }
  const antes = RASTRO.lista.length;
  RASTRO.lista = RASTRO.lista.filter(dentro);
  for (const m of RASTRO.tirados) if (!dentro(m)) RASTRO.tirados.delete(m);
  if (RASTRO.lista.length < cap) {
    const novos = d.monsters
      .filter((m) => dentro(m) && !RASTRO.lista.includes(m) && !RASTRO.tirados.has(m))
      .sort((a, b) => Math.hypot(a.x - d.px, a.y - d.py) - Math.hypot(b.x - d.px, b.y - d.py));
    for (const m of novos) {
      if (RASTRO.lista.length >= cap) break;
      RASTRO.lista.push(m);
    }
  }
  if (RASTRO.lista.length !== antes) RASTRO.desenhado = 0;
  painel(cap);
}

function painel(cap: number) {
  let el = RASTRO.el;
  if (!el) {
    if (!cap) return;
    el = RASTRO.el = document.createElement("div");
    el.id = "rastreio";
    el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-tirar]");
      if (b) rastreioTirar(RASTRO.lista[Number(b.dataset.tirar)]);
    });
    // junto do painel do alvo (#focus-hud), na mesma camada do campo
    (document.getElementById("focus-hud")?.parentElement ?? document.body).appendChild(el);
  }
  if (!cap) {
    el.style.display = "none";
    return;
  }
  el.style.display = "block";
  el.style.top = topoCanto(["dungeon-hud", "missao", "focus-hud"]) + "px";
  const agora = performance.now();
  if (agora - RASTRO.desenhado < 200) return;
  RASTRO.desenhado = agora;
  const d = dungeon,
    L: Record<string, string> = {
      wander: "patrulha",
      chase: "vem atrás",
      windup: "vai atacar!",
      leap: "bote!",
      recover: "exposto",
    };
  // a estrutura (linhas e botões) só é refeita quando a lista muda; senão, só os textos e as barras (o ✕ não some sob o dedo)
  if (
    cap !== RASTRO.capFeito ||
    RASTRO.lista.length !== RASTRO.feitos.length ||
    RASTRO.lista.some((m, i) => m !== RASTRO.feitos[i])
  ) {
    RASTRO.capFeito = cap;
    RASTRO.feitos = RASTRO.lista.slice();
    let h = '<div class="rs-tit">🐾 Rastreio <span>' + RASTRO.lista.length + "/" + cap + "</span></div>";
    RASTRO.lista.forEach((m, i) => {
      h +=
        '<div class="rs-l"><b>' +
        m.name +
        '</b><i></i><button data-tirar="' +
        i +
        '" title="Tirar do rastreio">✕</button><div class="rs-v"><u></u></div></div>';
    });
    if (!RASTRO.lista.length) h += '<div class="rs-vazio">Nada por perto</div>';
    el.innerHTML = h;
  }
  const linhas = el.querySelectorAll<HTMLElement>(".rs-l");
  RASTRO.lista.forEach((m, i) => {
    const ln = linhas[i];
    if (!ln) return;
    const pct = Math.max(0, Math.min(1, m.hp / m.hpMax)) * 100,
      dist = Math.hypot(m.x - d.px, m.y - d.py) / d.tile;
    ln.className =
      "rs-l" + (m === d.target ? " alvo" : "") + (m === d.foco ? " foco" : "") + (m.st === "windup" ? " perigo" : "");
    ln.querySelector("i")!.textContent = dist.toFixed(1) + " · " + (L[m.st] || m.st);
    ln.querySelector("u")!.style.width = pct.toFixed(0) + "%";
  });
}

/** Marca laranja em cima de cada rastreado (no canvas do campo, junto dos anéis de alvo e foco). */
export function rastreioMarcas(c: CanvasRenderingContext2D) {
  if (!RASTRO.lista.length) return;
  c.save();
  c.fillStyle = "rgba(255,154,60,0.85)";
  for (const m of RASTRO.lista) {
    if (!m.alive) continue;
    const y = m.y - 30;
    c.beginPath();
    c.moveTo(m.x - 4, y - 5);
    c.lineTo(m.x + 4, y - 5);
    c.lineTo(m.x, y);
    c.closePath();
    c.fill();
  }
  c.restore();
}
