/* ==== v8.3 â€” armadilhas no mapa. Onde hÃ¡ armadilha Ã© fixo (uma conta sobre a cÃ©lula, a mesma em toda partida):
   cerca de 2 em cada 100 cÃ©lulas, longe das cidades. Quando o herÃ³i chega perto de uma que ainda nÃ£o disparou, o aviso
   no alto da tela pisca. A perÃ­cia de cartÃ³grafo aumenta o alcance do aviso e, a partir do nÃ­vel 5, toca um bipe; no
   nÃ­vel 8 em diante pisca mais rÃ¡pido. Pisar numa dispara a armadilha (perde vida; fica marcada no minimapa com um X).
   O botÃ£o ðŸ“ do minimapa marca o ponto onde o herÃ³i estÃ¡, para ele anotar onde estÃ£o as armadilhas. ==== */
import { world, econ, dungeon } from "../core/state.ts";
import { CITIES } from "../data/economia.ts";
import { EXPLORA } from "./explorar.ts";

const ARM = {
  densidade: 0.02, // fraÃ§Ã£o das cÃ©lulas que tÃªm armadilha
  longeCidade: 160, // nenhuma armadilha a menos disso de uma cidade
  alcanceBase: 26, // alcance do aviso no nÃ­vel 0, em unidades do mapa
  alcancePorNivel: 14,
  bipeNivel: 5, // a partir daqui o aviso toca um bipe
  piscaRapidoNivel: 8,
  dano: 6,
};

const chave = (cx: number, cy: number) => (cy + 5000) * 10000 + (cx + 5000);

/** Um nÃºmero de 0 a 1 fixo para cada cÃ©lula (nÃ£o muda entre partidas). */
function dispersao(cx: number, cy: number): number {
  let h = Math.imul(cx, 374761393) ^ Math.imul(cy, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** A armadilha da cÃ©lula (cx, cy) existe? */
function armadilhaEm(cx: number, cy: number): boolean {
  if (dispersao(cx, cy) >= ARM.densidade) return false;
  const x = (cx + 0.5) * EXPLORA.celula,
    y = (cy + 0.5) * EXPLORA.celula;
  for (const ct of CITIES) if (Math.hypot(ct.x - x, ct.y - y) < ARM.longeCidade) return false;
  return true;
}

/** Armadilhas ainda nÃ£o disparadas a atÃ© `alcance` de (x, y): [centro x, centro y, distÃ¢ncia]. */
function armadilhasPerto(x: number, y: number, alcance: number): [number, number, number][] {
  const c = EXPLORA.celula,
    out: [number, number, number][] = [],
    disparadas = new Set(econ.armadilhasDisparadas ?? []);
  const x0 = Math.floor((x - alcance) / c),
    x1 = Math.floor((x + alcance) / c),
    y0 = Math.floor((y - alcance) / c),
    y1 = Math.floor((y + alcance) / c);
  for (let cy = y0; cy <= y1; cy++)
    for (let cx = x0; cx <= x1; cx++) {
      if (!armadilhaEm(cx, cy) || disparadas.has(chave(cx, cy))) continue;
      const mx = (cx + 0.5) * c,
        my = (cy + 0.5) * c,
        d = Math.hypot(mx - x, my - y);
      if (d <= alcance) out.push([mx, my, d]);
    }
  return out;
}

function nivelCartografo(): number {
  let n = 0;
  for (const h of world.heroes) {
    const s = h.skills?.cartografo;
    if (s && typeof s.level === "number") n = Math.max(n, s.level);
  }
  return n;
}

/* ---------- aviso na tela e bipe ---------- */
let som: AudioContext | null = null;
let ultimoBipe = 0;
let avisoAte = 0;
let perto = false;

function bipe() {
  try {
    som ||= new AudioContext();
    const o = som.createOscillator(),
      g = som.createGain();
    o.type = "square";
    o.frequency.value = 880;
    g.gain.value = 0.05;
    o.connect(g).connect(som.destination);
    o.start();
    o.stop(som.currentTime + 0.15);
  } catch (_) {}
}

function avisoEl(): HTMLElement {
  let el = document.getElementById("armadilha-aviso");
  if (!el) {
    el = document.createElement("div");
    el.id = "armadilha-aviso";
    document.body.appendChild(el);
  }
  return el;
}

/** Mostra o aviso por `durMs`; `ritmo` Ã© a classe de piscar. */
function mostrar(texto: string, ritmo: "" | "pisca" | "pisca-rapido", durMs: number) {
  const el = avisoEl();
  if (el.textContent !== texto) el.textContent = texto;
  el.className = "on " + ritmo;
  avisoAte = performance.now() + durMs;
}

/** Chamada a cada quadro do mapa (map/quadro.ts): dispara as armadilhas pisadas e acende o aviso perto delas. */
export function armadilhasQuadro() {
  if (dungeon.active && dungeon.mode !== "campo") return;
  const nivel = nivelCartografo(),
    alcance = ARM.alcanceBase + ARM.alcancePorNivel * nivel,
    agora = performance.now();
  let algumPerto = false;
  for (const h of world.heroes) {
    if (!Number.isFinite(h.x) || !Number.isFinite(h.y)) continue;
    // pisou: uma armadilha a menos de 30% da cÃ©lula dispara uma vez
    const pisou = armadilhasPerto(h.x, h.y, EXPLORA.celula * 0.3)[0];
    if (pisou) {
      econ.armadilhasDisparadas ||= [];
      const k = chave(Math.floor(pisou[0] / EXPLORA.celula), Math.floor(pisou[1] / EXPLORA.celula));
      econ.armadilhasDisparadas.push(k);
      h.hp = Math.max(1, (h.hp ?? 1) - ARM.dano);
      mostrar("ðŸ’¥ " + (h.name || "VocÃª") + " pisou numa armadilha!", "", 2600);
    }
    if (armadilhasPerto(h.x, h.y, alcance).length) algumPerto = true;
  }
  if (algumPerto) {
    // o aviso volta a piscar a cada 1,8 s enquanto houver armadilha por perto; o bipe toca ao chegar e, depois, de 2,5 s em 2,5 s
    if (agora > avisoAte) {
      mostrar("âš  Armadilha por perto", nivel >= ARM.piscaRapidoNivel ? "pisca-rapido" : "pisca", 1800);
      if (nivel >= ARM.bipeNivel && (!perto || agora - ultimoBipe > 2500)) {
        ultimoBipe = agora;
        bipe();
      }
    }
  } else {
    const el = document.getElementById("armadilha-aviso");
    if (el && agora > avisoAte && el.className) el.className = "";
  }
  perto = algumPerto;
}

/* ---------- minimapa: X das armadilhas disparadas e os pontos marcados ---------- */
export function armadilhasDesenhar(c: CanvasRenderingContext2D, k: number) {
  c.save();
  c.strokeStyle = "#ff7a5a";
  c.lineWidth = 1.6;
  for (const key of econ.armadilhasDisparadas ?? []) {
    const cx = (key % 10000) - 5000,
      cy = Math.floor(key / 10000) - 5000,
      x = (cx + 0.5) * EXPLORA.celula * k,
      y = (cy + 0.5) * EXPLORA.celula * k,
      s = 3;
    c.beginPath();
    c.moveTo(x - s, y - s);
    c.lineTo(x + s, y + s);
    c.moveTo(x + s, y - s);
    c.lineTo(x - s, y + s);
    c.stroke();
  }
  for (const [x, y] of econ.marcasMapa ?? []) {
    c.fillStyle = "#ffd27a";
    c.strokeStyle = "#2a1a08";
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(x * k, y * k, 3, 0, 7);
    c.fill();
    c.stroke();
  }
  c.restore();
}

/** O botÃ£o ðŸ“ do minimapa: marca o ponto onde o herÃ³i estÃ¡. */
export function marcarAqui() {
  const h = world.heroes.find((x) => Number.isFinite(x.x) && Number.isFinite(x.y));
  if (!h) return;
  econ.marcasMapa ||= [];
  econ.marcasMapa.push([Math.round(h.x), Math.round(h.y)]);
  mostrar("ðŸ“ Ponto marcado no minimapa", "", 1500);
}

