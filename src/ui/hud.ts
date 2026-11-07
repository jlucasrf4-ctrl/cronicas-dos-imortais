/* ==== Fase 4 — HUD do mapa: brasão, relógio, velocidades, minimapa (base/18) ==== */
import { TELAS, camera, JANELAS, world, dungeon } from "../core/state.ts";
import { constrainCamera, applyCameraTransform, zoomAt } from "../map/camera.ts";
import { explorarNevoa, vistos as explorados, EXPLORA } from "../map/explorar.ts";
import { armadilhasDesenhar, marcarAqui } from "../map/armadilhas.ts";
import { sairDoCampo } from "../map/transicao.ts";
import { openGameMenu } from "./titulo.ts";
import { openSlots } from "./paineis.ts";
import { winDock } from "./janelas.ts";
import { CONFIG } from "../core/config.ts";
import { fmtClock } from "../core/util.ts";
import { icoTag } from "./icones.ts";
import { QUAD, quadName, quadRegion } from "../map/quadrantes.ts";
import { arqName } from "../map/vila_musgo.ts";
import { phaseLabel } from "./painel.ts";
import { MAPART, MA_PAD } from "../map/vetorial.ts";
import { CITIES } from "../data/economia.ts";

/* ---------- HUD do mapa: brasão, relógio com sol/lua, velocidades, minimapa ---------- */
export const HUD = {
  mm: null as HTMLCanvasElement | null,
  mmBase: null as HTMLCanvasElement | null,
  mmDrag: false,
  t: 0,
  regiao: null as string | null, // v7.7: a região ativa que o rótulo do HUD mostra
};

export function hudBuild() {
  const app = document.getElementById("app")!,
    top = document.createElement("div");
  top.id = "hud-top";
  top.innerHTML =
    '<div id="hud-crest"><svg viewBox="0 0 40 44"><defs><linearGradient id="hcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6dc9c"/><stop offset="1" stop-color="#9c6a26"/></linearGradient></defs><path d="M20 2 L37 8 V22 C37 33 29 39 20 42 C11 39 3 33 3 22 V8 Z" fill="#2a1c0c" stroke="url(#hcg)" stroke-width="2"/><circle cx="20" cy="21" r="9" fill="none" stroke="#b896ff" stroke-width="1.3" opacity=".9"/><path d="M20 12 L20 30 M14 17 L26 25 M26 17 L14 25" stroke="url(#hcg)" stroke-width="1.6"/></svg><div><b>Crônicas dos Imortais</b><span id="hud-region">Mapa Vivo</span></div></div>' +
    '<div id="hud-clock"><div id="hud-dial"><svg viewBox="0 0 230 40"><path d="M15 38 Q115 -16 215 38" fill="none" stroke="rgba(224,179,95,.35)" stroke-width="1.4" stroke-dasharray="3 4"/></svg><div id="hud-sun"><i class="ic ico-ui_dia sun"></i></div><div id="hud-day">Dia 1</div></div><div id="hud-time">06:00 · Amanhecer</div>' +
    '<div id="hud-speed"><button data-hs="pause" title="Pausar / continuar">❚❚</button><button data-hs="1">1×</button><button data-hs="3">3×</button><button data-hs="8">8×</button><button data-hs="h" title="Avançar 1 hora">+1h</button><button data-hs="d" title="Avançar 1 dia">+1d</button></div></div>' +
    '<div id="hud-right"><button class="hud-ib" id="hud-save" title="Salvar jogo"><i class="ic ico-ui_salvar"></i></button><button class="hud-ib" id="hud-menu" title="Menu (Esc)"><i class="ic ico-ui_menu"></i> Menu</button></div>';
  app.appendChild(top);
  const vig = document.createElement("div");
  vig.id = "map-vig";
  document.getElementById("viewport")!.appendChild(vig);
  top.querySelector("#hud-speed")!.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b) return;
    const s = b.dataset.hs;
    if (s === "pause") document.getElementById("btn-pause")!.click();
    else if (s === "h") document.getElementById("ff-hour")!.click();
    else if (s === "d") document.getElementById("ff-day")!.click();
    else {
      const x = document.querySelector('[data-speed="' + s + '"]') as HTMLElement;
      if (x) x.click();
    }
    hudUpdate();
  });
  top.querySelector("#hud-menu")!.addEventListener("click", openGameMenu);
  top.querySelector("#hud-save")!.addEventListener("click", () => openSlots("save", () => {}));
  // minimapa
  const mm = document.createElement("div");
  mm.id = "minimap";
  mm.innerHTML =
    '<canvas width="200" height="150"></canvas><div class="mm-t">MAPA</div>' +
    '<div id="mm-ferr"><button id="mm-mais" title="Aproximar o mapa">＋</button><button id="mm-menos" title="Afastar o mapa">－</button><button id="mm-marca" title="Marcar no minimapa onde o herói está (anote as armadilhas)">📍</button><button id="mm-volta" title="Voltar ao modo mapa">🗺 Mapa</button></div>';
  app.appendChild(mm);
  HUD.mm = mm.querySelector("canvas");
  // v8.3 — botões do minimapa: zoom sem a roda, e voltar ao mapa de dentro do campo (sem rolar o mouse)
  const centroVista = () => {
    const r = TELAS.viewport.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2] as const;
  };
  mm.querySelector("#mm-mais")!.addEventListener("click", (e) => {
    e.stopPropagation();
    if (dungeon.active) return;
    // abaixo do limite: o zoom do mapa não entra no campo (map/camera.ts zoomAt só entra pela heroína com o cursor nela)
    if ((camera.zt || camera.scale) >= camera.maxScale * 0.97) return;
    const [x, y] = centroVista();
    zoomAt(1.3, x, y);
  });
  mm.querySelector("#mm-menos")!.addEventListener("click", (e) => {
    e.stopPropagation();
    if (dungeon.active) return;
    const [x, y] = centroVista();
    zoomAt(1 / 1.3, x, y);
  });
  mm.querySelector("#mm-marca")!.addEventListener("click", (e) => {
    e.stopPropagation();
    marcarAqui();
  });
  mm.querySelector("#mm-volta")!.addEventListener("click", (e) => {
    e.stopPropagation();
    if (dungeon.active) sairDoCampo();
  });
  const go = (e: PointerEvent) => {
    if (dungeon.active) return; // no campo o clique não mexe na câmera do mapa (escondida)
    const r = HUD.mm!.getBoundingClientRect(),
      wx = ((e.clientX - r.left) / r.width) * TELAS.worldW,
      wy = ((e.clientY - r.top) / r.height) * TELAS.worldH,
      vw = TELAS.viewport.clientWidth,
      vh = TELAS.viewport.clientHeight;
    camera.tx = vw / 2 - wx * camera.scale;
    camera.ty = vh / 2 - wy * camera.scale;
    constrainCamera();
    applyCameraTransform();
    hudMinimap();
  };
  HUD.mm!.addEventListener("pointerdown", (e) => {
    HUD.mmDrag = true;
    try {
      HUD.mm!.setPointerCapture(e.pointerId);
    } catch (_) {}
    go(e);
    e.stopPropagation();
  });
  HUD.mm!.addEventListener("pointermove", (e) => {
    if (HUD.mmDrag) go(e);
  });
  HUD.mm!.addEventListener("pointerup", () => {
    HUD.mmDrag = false;
  });
  // a janela de ferramentas (velocidade/camadas/modo teste) já está no relógio: começa fechada, mas continua na barra de janelas
  if (!JANELAS.winSt.controls) {
    JANELAS.winSt.controls = { hidden: true };
    const el = document.querySelector("#controls");
    if (el) el.classList.add("win-hidden");
    winDock();
  }
  const zc = document.getElementById("zoom-controls");
  if (zc) zc.style.bottom = "calc(10px + env(safe-area-inset-bottom,0px))";
}
export function hudUpdate() {
  if (!document.getElementById("hud-top")) return;
  const tod = world.tick % CONFIG.DAY_MIN,
    day = Math.floor(world.tick / CONFIG.DAY_MIN) + 1;
  // v7.7: cada parte só é escrita quando muda (escrever o mesmo texto ou o mesmo filtro também refaz o desenho)
  const muda = (el: HTMLElement, txt: string) => {
    if (el.textContent !== txt) el.textContent = txt;
  };
  muda(document.getElementById("hud-day")!, "Dia " + day);
  muda(document.getElementById("hud-time")!, fmtClock(world.tick) + " · " + phaseLabel(world.tick));
  const isDay = tod > 5.5 * 60 && tod < 19.5 * 60,
    p = isDay ? (tod - 5.5 * 60) / (14 * 60) : (tod + (tod < 5.5 * 60 ? 24 * 60 : 0) - 19.5 * 60) / (10 * 60);
  const x = 15 + 200 * p,
    y = 38 - 54 * (2 * p * (1 - p)) * 1.0,
    sun = document.getElementById("hud-sun")!,
    left = ((x / 230) * 100).toFixed(1) + "%",
    top = ((y / 40) * 100).toFixed(1) + "%";
  if (sun.style.left !== left) sun.style.left = left;
  if (sun.style.top !== top) sun.style.top = top;
  if (sun._sk !== isDay) {
    sun._sk = isDay;
    sun.innerHTML = icoTag(isDay ? "ui_dia" : "ui_noite", isDay ? "☀️" : "🌙", "sun");
    sun.style.filter = isDay ? "drop-shadow(0 0 6px rgba(255,200,90,.9))" : "drop-shadow(0 0 6px rgba(180,200,255,.8))";
  }
  const bs = document.querySelectorAll("#hud-speed button");
  bs.forEach((b) => {
    const s = (b as HTMLElement).dataset.hs!,
      on = s === "pause" ? world.paused : !world.paused && +s === world.speedMult;
    if (b.classList.contains("on") !== on) b.classList.toggle("on", on);
    if (s === "pause") muda(b as HTMLElement, world.paused ? "▶" : "❚❚");
  });
  const hr = document.getElementById("hud-region");
  const arq = QUAD.active ? arqName(QUAD.active) : null;
  if (hr && QUAD.active && HUD.regiao !== QUAD.active + "|" + arq) {
    HUD.regiao = QUAD.active + "|" + arq;
    hr.textContent =
      (arq ? "🐟 " + arq + " · " : "Região ativa " + quadName(QUAD.active) + " · ") + quadRegion(QUAD.active);
  }
  // v8.3 — no campo o minimapa mostra só "Mapa" (volta); no mapa, os botões de zoom
  const emCampo = !!dungeon.active;
  const mmEl = document.getElementById("minimap");
  if (mmEl) mmEl.classList.toggle("cena-intro", emCampo && dungeon.mode === "intro");
  const vol = document.getElementById("mm-volta"),
    zs = [document.getElementById("mm-mais"), document.getElementById("mm-menos")];
  if (vol && vol.style.display !== (emCampo ? "" : "none")) vol.style.display = emCampo ? "" : "none";
  for (const z of zs) if (z && z.style.display !== (emCampo ? "none" : "")) z.style.display = emCampo ? "none" : "";
  hudMinimap();
}
/** v8.3 — no campo o `#app` fica escondido (expedicao/preparo.ts), e o minimapa morava nele: entrando, ele vai para
    o `#dungeon-view`; saindo, volta para o `#app`. Na cena inicial ele não aparece. */
export function hudMinimapLugar(noCampo: boolean) {
  const mm = document.getElementById("minimap"),
    alvo = document.getElementById(noCampo ? "dungeon-view" : "app");
  if (!mm || !alvo) return;
  if (mm.parentElement !== alvo) alvo.appendChild(mm);
  mm.classList.toggle("no-campo", noCampo);
  hudUpdate();
}
/** v8.3 — o minimapa do campo: redondo, pequeno, só a volta da heroína (mantenedor 2026-11-07: "quero algo mais
    local, redondo e discreto no cantinho"). `raio` em unidades do mapa (a vista do campo tem ~137 de largura), `px` =
    diâmetro na tela, `nitidez` = pixels do canvas por pixel da tela. */
const MM_LOCAL = { raio: 120, px: 128, nitidez: 2 };
const MML = { fog: null as HTMLCanvasElement | null };
function hudMinimapLocal(cv: HTMLCanvasElement) {
  const S = MM_LOCAL.px * MM_LOCAL.nitidez;
  if (cv.width !== S || cv.height !== S) {
    cv.width = S;
    cv.height = S;
    HUD.mmBase = null; // a base do mapa inteiro é refeita quando voltar ao mapa
  }
  const h = dungeon.hero && world.heroes.includes(dungeon.hero) ? dungeon.hero : world.heroes[0];
  const c = cv.getContext("2d")!;
  c.clearRect(0, 0, S, S);
  if (!h || !Number.isFinite(h.x) || !Number.isFinite(h.y)) return;
  const R = MM_LOCAL.raio,
    k = S / (2 * R),
    x0 = h.x - R,
    y0 = h.y - R;
  c.save();
  c.beginPath();
  c.arc(S / 2, S / 2, S / 2, 0, 7);
  c.clip();
  c.fillStyle = "#1d2a33"; // fora do mapa: mar escuro
  c.fillRect(0, 0, S, S);
  c.imageSmoothingQuality = "high";
  // a fonte mais nítida que houver: a arte vetorial do mapa ou a imagem do mapa
  const img = TELAS.mapImg,
    kImg = img.naturalWidth / TELAS.worldW,
    kOv = MAPART.on && MAPART.ready ? (MAPART.ov.width - MA_PAD * 2) / TELAS.worldW : 0;
  if (kOv >= kImg) c.drawImage(MAPART.ov, MA_PAD + x0 * kOv, MA_PAD + y0 * kOv, 2 * R * kOv, 2 * R * kOv, 0, 0, S, S);
  else c.drawImage(img, x0 * kImg, y0 * kImg, 2 * R * kImg, 2 * R * kImg, 0, 0, S, S);
  // névoa: só as células já exploradas aparecem
  if (!MML.fog || MML.fog.width !== S) {
    MML.fog = document.createElement("canvas");
    MML.fog.width = S;
    MML.fog.height = S;
  }
  const f = MML.fog.getContext("2d")!;
  f.globalCompositeOperation = "source-over";
  f.clearRect(0, 0, S, S);
  f.fillStyle = "rgba(12,8,4,.8)";
  f.fillRect(0, 0, S, S);
  f.globalCompositeOperation = "destination-out";
  const cel = EXPLORA.celula,
    cs = cel * k;
  for (const key of explorados()) {
    const cx = (key % 10000) - 5000,
      cy = Math.floor(key / 10000) - 5000,
      px = (cx * cel - x0) * k,
      py = (cy * cel - y0) * k;
    if (px > S || py > S || px + cs < 0 || py + cs < 0) continue;
    f.fillRect(px, py, cs + 1, cs + 1);
  }
  f.globalCompositeOperation = "source-over";
  c.drawImage(MML.fog, 0, 0);
  // armadilhas disparadas, pontos marcados e cidades, nas mesmas contas do mapa inteiro
  c.save();
  c.translate(-x0 * k, -y0 * k);
  armadilhasDesenhar(c, k);
  for (const ct of CITIES) {
    c.fillStyle = "#ffe08a";
    c.strokeStyle = "#2a1a08";
    c.lineWidth = 1.5 * MM_LOCAL.nitidez;
    c.beginPath();
    c.arc(ct.x * k, ct.y * k, 3 * MM_LOCAL.nitidez, 0, 7);
    c.fill();
    c.stroke();
  }
  // os outros heróis por perto
  for (const o of world.heroes) {
    if (o === h || !Number.isFinite(o.x)) continue;
    c.fillStyle = o.color;
    c.strokeStyle = "#fff";
    c.lineWidth = MM_LOCAL.nitidez;
    c.beginPath();
    c.arc(o.x * k, o.y * k, 2.6 * MM_LOCAL.nitidez, 0, 7);
    c.fill();
    c.stroke();
  }
  c.restore();
  // a heroína no meio
  c.fillStyle = h.color;
  c.strokeStyle = "#fff";
  c.lineWidth = 1.4 * MM_LOCAL.nitidez;
  c.shadowColor = "#000";
  c.shadowBlur = 4;
  c.beginPath();
  c.arc(S / 2, S / 2, 3.6 * MM_LOCAL.nitidez, 0, 7);
  c.fill();
  c.stroke();
  c.restore();
}
export function hudMinimap() {
  const cv = HUD.mm;
  if (!cv || !TELAS.worldW || !TELAS.mapImg || !TELAS.mapImg.complete) return;
  if (dungeon.active) return hudMinimapLocal(cv);
  if (cv.width !== 200) cv.width = 200;
  const W = cv.width,
    H = Math.round((W * TELAS.worldH) / TELAS.worldW);
  if (cv.height !== H) {
    cv.height = H;
    HUD.mmBase = null;
  }
  if (!HUD.mmBase) {
    const b = document.createElement("canvas");
    b.width = W;
    b.height = H;
    const bc = b.getContext("2d")!;
    bc.imageSmoothingQuality = "high";
    if (MAPART.on && MAPART.ready)
      bc.drawImage(MAPART.ov, MA_PAD, MA_PAD, MAPART.ov.width - MA_PAD * 2, MAPART.ov.height - MA_PAD * 2, 0, 0, W, H);
    else bc.drawImage(TELAS.mapImg, 0, 0, W, H);
    bc.fillStyle = "rgba(20,12,4,.18)";
    bc.fillRect(0, 0, W, H);
    HUD.mmBase = b;
  }
  const c = cv.getContext("2d")!,
    k = W / TELAS.worldW;
  c.clearRect(0, 0, W, H);
  c.drawImage(HUD.mmBase, 0, 0);
  // v8.3 — névoa: só o que o herói já explorou aparece (map/explorar.ts)
  explorarNevoa(c, W, H, k);
  armadilhasDesenhar(c, k); // v8.3: armadilhas disparadas (X) e os pontos marcados (📍)
  c.save();
  c.strokeStyle = "rgba(255,240,200,.22)";
  c.lineWidth = 0.8;
  c.beginPath();
  for (let i = 1; i < QUAD.cols; i++) {
    c.moveTo(i * QUAD.w * k, 0);
    c.lineTo(i * QUAD.w * k, H);
  }
  for (let j = 1; j < QUAD.rows; j++) {
    c.moveTo(0, j * QUAD.h * k);
    c.lineTo(W, j * QUAD.h * k);
  }
  c.stroke();
  const sb = CONFIG.SIM_BOUNDS;
  c.fillStyle = "rgba(255,226,150,.16)";
  c.fillRect(sb.x * k, sb.y * k, sb.w * k, sb.h * k);
  c.setLineDash([3, 3]);
  c.strokeStyle = "rgba(255,226,150,.9)";
  c.strokeRect(sb.x * k, sb.y * k, sb.w * k, sb.h * k);
  c.restore();
  for (const ct of CITIES) {
    c.fillStyle = "#ffe08a";
    c.strokeStyle = "#2a1a08";
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(ct.x * k, ct.y * k, 2.6, 0, 7);
    c.fill();
    c.stroke();
  }
  for (const h of world.heroes) {
    c.fillStyle = h.color;
    c.strokeStyle = "#fff";
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(h.x * k, h.y * k, 3.4, 0, 7);
    c.fill();
    c.stroke();
  }
  const vw = TELAS.viewport.clientWidth,
    vh = TELAS.viewport.clientHeight,
    x0 = -camera.tx / camera.scale,
    y0 = -camera.ty / camera.scale;
  c.strokeStyle = "#f0c66e";
  c.lineWidth = 1.6;
  c.shadowColor = "#000";
  c.shadowBlur = 3;
  c.strokeRect(x0 * k, y0 * k, (vw / camera.scale) * k, (vh / camera.scale) * k);
  c.shadowBlur = 0;
}
