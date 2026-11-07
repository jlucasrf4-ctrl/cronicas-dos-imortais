/* ==== Fase 4 — desenho do mapa: camadas, animais, heróis, e clicar num animal (base/01) ==== */
import { mapCompose, MAPART } from "./vetorial.ts";
import { TELAS, camera, world, SEL } from "../core/state.ts";
import { resizeCanvas } from "./camera.ts";
import { CONFIG } from "../core/config.ts";
import { PLANTS, SPECIES } from "../data/especies.ts";
import { hexToRgba } from "../core/util.ts";
import { termiteDraw } from "../sim/cupinzeiros.ts";
import { CITIES } from "../data/economia.ts";
import { campDraw } from "../survival/acampamento.ts";
import { runeDrawMap, runeAura } from "../runas/runas.ts";
import { drawNodes, drawWild } from "../sim/fauna.ts";
import { effRadius } from "../sim/animais.ts";
import { visCenters, visK, farDot, medirVista, naVista } from "../render/desempenho.ts";
import { SPR, ATLAS, fitSz, drawSprite } from "../render/sprites.ts";
import { desenharLoboCarregado } from "../campanha/cercado.ts";
import { desenharSelecao } from "./selecao.ts";
import type { Animal, Hero, Repasse } from "../core/tipos.ts";

/* ---------------------------------------------------------------------
   12. RENDERING ENGINE
--------------------------------------------------------------------- */
export const layers = { fauna: true, flora: true, water: false, bounds: true };
export function renderFrame() {
  mapCompose();
  if (
    TELAS.canvas.width !== Math.round(TELAS.viewport.clientWidth * TELAS.canvasDpr) ||
    TELAS.canvas.height !== Math.round(TELAS.viewport.clientHeight * TELAS.canvasDpr)
  )
    resizeCanvas();
  TELAS.ctx.setTransform(1, 0, 0, 1, 0, 0);
  TELAS.ctx.clearRect(0, 0, TELAS.canvas.width, TELAS.canvas.height);
  TELAS.ctx.setTransform(
    TELAS.canvasDpr * camera.scale,
    0,
    0,
    TELAS.canvasDpr * camera.scale,
    TELAS.canvasDpr * camera.tx,
    TELAS.canvasDpr * camera.ty,
  );
  TELAS.ctx.imageSmoothingEnabled = true;
  TELAS.ctx.imageSmoothingQuality = "medium"; // v7.7: "high" pesava (sprites dos bichos)
  medirVista(TELAS.viewport.clientWidth, TELAS.viewport.clientHeight, camera.scale, camera.tx, camera.ty);

  // limite simulado
  if (layers.bounds) {
    const b = CONFIG.SIM_BOUNDS;
    TELAS.ctx.save();
    TELAS.ctx.setLineDash([8, 6]);
    TELAS.ctx.strokeStyle = "rgba(224,179,95,0.55)";
    TELAS.ctx.lineWidth = 2;
    TELAS.ctx.strokeRect(b.x, b.y, b.w, b.h);
    TELAS.ctx.restore();
  }

  // água detectada (debug visual sutil)
  if (layers.water) {
    TELAS.ctx.fillStyle = "rgba(90,170,220,0.35)";
    const step = world.waterGridStep;
    for (const p of world.waterPoints) {
      TELAS.ctx.fillRect(p.x - step / 2, p.y - step / 2, step, step);
    }
  }

  // vegetação
  if (layers.flora) {
    // v7.7: as plantas da mesma cor (tipo e degrau de alfa) num caminho só, preenchido de uma vez (antes, um fill por
    // planta: ~1.300 por quadro). Elas não se sobrepõem (22 de espaçamento, raio até 4,2), então o desenho é o mesmo.
    const grupos = new Map<string, Path2D>();
    for (const p of world.veg) {
      const g = p.growth;
      if (g < 0.08 || !naVista(p.x, p.y, 6)) continue;
      const cor = corPlanta(p.kind, Math.round((0.3 + g * 0.55) * 20)),
        r = 1.8 + g * 2.4;
      let c = grupos.get(cor);
      if (!c) grupos.set(cor, (c = new Path2D()));
      c.moveTo(p.x + r, p.y);
      c.arc(p.x, p.y, r, 0, Math.PI * 2);
    }
    for (const [cor, c] of grupos) {
      TELAS.ctx.fillStyle = cor;
      TELAS.ctx.fill(c);
    }
    if (SEL.selectedPlant) {
      TELAS.ctx.beginPath();
      TELAS.ctx.strokeStyle = "#fff8e3";
      TELAS.ctx.lineWidth = 2 / camera.scale;
      TELAS.ctx.arc(SEL.selectedPlant.x, SEL.selectedPlant.y, 7, 0, Math.PI * 2);
      TELAS.ctx.stroke();
    }
  }

  if (layers.fauna) {
    // carcaças (somem conforme são consumidas)
    for (const c of world.carcasses) {
      if (!naVista(c.x, c.y)) continue;
      const f = Math.max(0.15, c.amount / c.max);
      TELAS.ctx.save();
      TELAS.ctx.translate(c.x, c.y);
      TELAS.ctx.rotate(c.dir);
      TELAS.ctx.globalAlpha = 0.35 + 0.5 * f;
      TELAS.ctx.fillStyle = "#3a1f1f";
      TELAS.ctx.beginPath();
      TELAS.ctx.ellipse(0, 0, c.r * 1.5 * (0.5 + 0.5 * f), c.r * (0.5 + 0.5 * f), 0, 0, Math.PI * 2);
      TELAS.ctx.fill();
      TELAS.ctx.strokeStyle = c.color;
      TELAS.ctx.lineWidth = 1;
      TELAS.ctx.stroke();
      TELAS.ctx.restore();
    }
  }
  runeDrawMap();
  // animais
  if (layers.fauna) {
    for (const a of world.animals) {
      if (!a.alive || !naVista(a.x, a.y, 40)) continue;
      drawAnimal(a);
    }
  }

  try {
    termiteDraw();
  } catch (_) {}
  drawNodes();
  if (layers.fauna) drawWild();
  // heróis (sempre visíveis, são o personagem do jogador — não dependem do toggle de fauna selvagem)
  TELAS.ctx.save();
  TELAS.ctx.font = "bold 9px Lora, serif";
  TELAS.ctx.textAlign = "center";
  if (!(MAPART.on && MAPART.ready))
    for (const c of CITIES) {
      TELAS.ctx.fillStyle = "#e0b35f";
      TELAS.ctx.strokeStyle = "#241508";
      TELAS.ctx.lineWidth = 2;
      TELAS.ctx.beginPath();
      TELAS.ctx.arc(c.x, c.y - 14, 4, 0, 7);
      TELAS.ctx.fill();
      TELAS.ctx.stroke();
      TELAS.ctx.strokeText(c.name, c.x, c.y - 21);
      TELAS.ctx.fillStyle = "#fff8e3";
      TELAS.ctx.fillText(c.name, c.x, c.y - 21);
    }
  TELAS.ctx.restore();
  try {
    campDraw();
  } catch (_) {}
  for (const h of world.heroes) drawHero(h);
  desenharSelecao(TELAS.ctx); // v7.7: heróis selecionados (map/selecao.ts)

  // destaque do selecionado
  if (SEL.selectedAnimal && SEL.selectedAnimal.alive) {
    TELAS.ctx.beginPath();
    TELAS.ctx.strokeStyle = "#fff8e3";
    TELAS.ctx.lineWidth = 2 / camera.scale;
    TELAS.ctx.arc(
      SEL.selectedAnimal.x,
      SEL.selectedAnimal.y,
      Math.max(effRadius(SEL.selectedAnimal) + 6, (SEL.selectedAnimal._sz || 0) / 2 + 3),
      0,
      Math.PI * 2,
    );
    TELAS.ctx.stroke();
  }
}
/** A cor de uma planta do tipo `kind` com alfa de `degrau`/20 (guardada: o desenho pede milhares por quadro). */
const CORES_PLANTA: Record<string, string[]> = {};
function corPlanta(kind: string, degrau: number) {
  const L = CORES_PLANTA[kind] || (CORES_PLANTA[kind] = []);
  return L[degrau] || (L[degrau] = hexToRgba(PLANTS[kind] ? PLANTS[kind].color : "#5a9646", degrau / 20));
}
function drawAnimal(this: unknown, a: Animal) {
  /* v6.6 */
  const C = visCenters(),
    k = C.length ? visK(a.x, a.y, C) : 1;
  if (k <= 0) {
    if (Math.random() < 1) farDot(a.x, a.y, (SPECIES[a.species] || {}).color);
    return;
  }
  if (k < 1) {
    TELAS.ctx.save();
    TELAS.ctx.globalAlpha = k;
    try {
      return drawAnimalBase.apply(this, arguments as Repasse);
    } finally {
      TELAS.ctx.restore();
    }
  }
  return drawAnimalBase.apply(this, arguments as Repasse);
}
// etapa de drawAnimal: original
function drawAnimalBase(a: Animal) {
  const sp = SPECIES[a.species];
  const r = effRadius(a);
  if (a.runic && a.alive) runeAura(a); // porte genético: bichos "Avantajado"/"Colossal" aparecem maiores de verdade
  // trilha (v7.7: o último ponto é a posição real, depois do passo; a linha termina onde o bicho é desenhado, na
  // posição visual entre os dois passos, em vez de passar à frente dele)
  if (a.trail.length > 1) {
    TELAS.ctx.beginPath();
    TELAS.ctx.strokeStyle = sp.color + "55";
    TELAS.ctx.lineWidth = 1;
    TELAS.ctx.moveTo(a.trail[0].x, a.trail[0].y);
    for (let i = 1; i < a.trail.length - 1; i++) TELAS.ctx.lineTo(a.trail[i].x, a.trail[i].y);
    TELAS.ctx.lineTo(a.x, a.y);
    TELAS.ctx.stroke();
  }
  const _eat = a.state === "eating",
    _bob = _eat ? Math.sin(performance.now() / 90 + a.x) * r * 0.4 : 0;
  const _spOK = !!SPR[a.species] && ATLAS.complete && ATLAS.naturalWidth > 0;
  if (_spOK) {
    const sz = fitSz(Math.max(15, r * 4.4));
    a._sz = sz;
    const bob =
      Math.sin(performance.now() / (a.state === "fleeing" ? 70 : 300) + a.x) * (a.state === "idle" ? 0.3 : 0.9);
    TELAS.ctx.save();
    TELAS.ctx.globalAlpha = 0.25;
    TELAS.ctx.fillStyle = "#000";
    TELAS.ctx.beginPath();
    TELAS.ctx.ellipse(a.x, a.y + sz * 0.38, sz * 0.38, sz * 0.14, 0, 0, 7);
    TELAS.ctx.fill();
    TELAS.ctx.restore();
    drawSprite(a.species, a.sex, a.genes.coat, a.x, a.y + bob, sz, a.energy < 20 ? 0.6 : 1);
  } else {
    // sem sprite: a seta (v7.7: com sprite ela era desenhada mesmo assim, com alfa 0 — invisível)
    TELAS.ctx.save();
    if (a.energy < 20) TELAS.ctx.globalAlpha = 0.6; // exausto: visivelmente apagado
    TELAS.ctx.translate(a.x + Math.cos(a.dir) * _bob, a.y + Math.sin(a.dir) * _bob);
    TELAS.ctx.rotate(a.dir + (_eat ? 0.3 : 0));
    TELAS.ctx.beginPath();
    TELAS.ctx.fillStyle = sp.color;
    TELAS.ctx.moveTo(r * 1.6, 0);
    TELAS.ctx.lineTo(-r, r * 0.9);
    TELAS.ctx.lineTo(-r * 0.5, 0);
    TELAS.ctx.lineTo(-r, -r * 0.9);
    TELAS.ctx.closePath();
    TELAS.ctx.fill();
    TELAS.ctx.restore();
  }

  // anel de estado
  let ringColor = null;
  if (a.state === "fleeing") ringColor = "#ffe08a";
  else if (a.state === "hunting") ringColor = "#ff6b6b";
  else if (a.state === "drinking" || a.state === "seekWater") ringColor = "#8fd1ff";
  else if (a.state === "eating" || a.state === "seekFood") ringColor = "#9fe08a";
  if (ringColor) {
    TELAS.ctx.beginPath();
    TELAS.ctx.strokeStyle = ringColor;
    TELAS.ctx.lineWidth = 1.4;
    TELAS.ctx.arc(a.x, a.y, r + 3, 0, Math.PI * 2);
    TELAS.ctx.stroke();
  }
}
/** v8.0 — o marcador do herói no mapa (anel com a ponta para baixo, arte de tools:marcador): altura em unidades do
 *  mapa, onde fica o centro do anel na imagem (fração da altura), a arte própria de uma cor de herói (as outras tingem
 *  o anel branco) e a da caça. */
const MARCADOR = {
  alto: 22,
  centro: 0.4,
  proprio: { "#ffd27a": "dourado" } as Record<string, string>,
  caca: "vermelho",
};
const MARCADOR_ARTE: Record<string, string> = {
  branco: "/src/assets/art/marcador_branco.webp",
  dourado: "/src/assets/art/marcador_dourado.webp",
  vermelho: "/src/assets/art/marcador_vermelho.webp",
};
const MARC = { img: {} as Record<string, HTMLImageElement>, tinto: {} as Record<string, HTMLCanvasElement> };
function marcadorArte(nome: string) {
  let im = MARC.img[nome];
  if (!im) {
    im = MARC.img[nome] = new Image();
    im.src = MARCADOR_ARTE[nome];
  }
  return im.complete && im.naturalWidth > 0 ? im : null;
}
/** A imagem do marcador do herói (null enquanto a arte carrega: aí sai o losango de antes). */
function marcadorDe(h: Hero): HTMLImageElement | HTMLCanvasElement | null {
  if (h.state === "hunting") return marcadorArte(MARCADOR.caca);
  const proprio = MARCADOR.proprio[h.color];
  if (proprio) return marcadorArte(proprio);
  const b = marcadorArte("branco");
  if (!b) return null;
  let c = MARC.tinto[h.color];
  if (!c) {
    // o anel branco vezes a cor do herói, recortado de novo pelo alfa do anel
    c = MARC.tinto[h.color] = document.createElement("canvas");
    c.width = b.naturalWidth;
    c.height = b.naturalHeight;
    const g = c.getContext("2d")!;
    g.drawImage(b, 0, 0);
    g.globalCompositeOperation = "multiply";
    g.fillStyle = h.color;
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = "destination-in";
    g.drawImage(b, 0, 0);
  }
  return c;
}
function drawHero(h: Hero) {
  if (h.trail.length > 1 && h.state !== "idle") {
    TELAS.ctx.beginPath();
    TELAS.ctx.strokeStyle = hexToRgba(h.color, 0.4);
    TELAS.ctx.lineWidth = 1.2;
    TELAS.ctx.moveTo(h.trail[0].x, h.trail[0].y);
    for (let i = 1; i < h.trail.length; i++) TELAS.ctx.lineTo(h.trail[i].x, h.trail[i].y);
    TELAS.ctx.lineTo(h.x, h.y); // v7.7: o rastro do herói é guardado antes do passo; termina onde ele aparece
    TELAS.ctx.stroke();
  }
  const s = 7.5,
    marc = marcadorDe(h);
  if (marc) {
    const H = MARCADOR.alto,
      W = (H * marc.width) / marc.height;
    TELAS.ctx.drawImage(marc, h.x - W / 2, h.y - H * MARCADOR.centro, W, H);
  } else {
    TELAS.ctx.save();
    TELAS.ctx.translate(h.x, h.y);
    TELAS.ctx.beginPath();
    TELAS.ctx.moveTo(0, -s);
    TELAS.ctx.lineTo(s * 0.68, 0);
    TELAS.ctx.lineTo(0, s);
    TELAS.ctx.lineTo(-s * 0.68, 0);
    TELAS.ctx.closePath();
    TELAS.ctx.fillStyle = h.color;
    TELAS.ctx.fill();
    TELAS.ctx.lineWidth = 1.3;
    TELAS.ctx.strokeStyle = "#1c140b";
    TELAS.ctx.stroke();
    TELAS.ctx.restore();
  }
  desenharLoboCarregado(h, TELAS.ctx); // v7.7 — campanha: o lobo que ela leva para o cercado

  TELAS.ctx.save();
  TELAS.ctx.font = "9px Lora, serif";
  TELAS.ctx.textAlign = "center";
  TELAS.ctx.fillStyle = "#1c140b";
  TELAS.ctx.fillText(h.name, h.x + 0.4, h.y - 10.6);
  TELAS.ctx.fillStyle = "#fff8e3";
  TELAS.ctx.fillText(h.name, h.x, h.y - 11);
  TELAS.ctx.restore();

  // caçando: com a arte, o próprio marcador fica vermelho; viajando/voltando: o anel fino por fora do marcador
  if ((h.state === "hunting" && !marc) || h.state === "traveling" || h.state === "returning") {
    TELAS.ctx.beginPath();
    TELAS.ctx.strokeStyle = h.state === "hunting" ? "#ff6b6b" : hexToRgba(h.color, 0.9);
    TELAS.ctx.lineWidth = 1.3;
    TELAS.ctx.arc(h.x, h.y, marc ? MARCADOR.alto * 0.62 : s + 3.5, 0, Math.PI * 2);
    TELAS.ctx.stroke();
  }
}

/* ---------------------------------------------------------------------
   13. PICKING — clicar num animal
--------------------------------------------------------------------- */
export function pickAnimalAt(worldX: number, worldY: number) {
  let best = null,
    bestD = 14;
  for (const a of world.animals) {
    if (!a.alive) continue;
    const d = Math.hypot(a.x - worldX, a.y - worldY);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}
export function pickPlantAt(worldX: number, worldY: number) {
  let best = null,
    bestD = 10;
  for (const p of world.veg) {
    if (p.growth < 0.08) continue;
    const d = Math.hypot(p.x - worldX, p.y - worldY);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}
