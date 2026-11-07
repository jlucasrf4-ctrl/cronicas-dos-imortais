/* ==== v7.7 — o quadro do mapa num laço só (core/laco.ts) ====
   Antes havia três requestAnimationFrame no mapa: o laço principal (simulação e desenho), o mapLoop de
   v6.4_moitas_criacao (WASD/borda e chegar no acampamento) e o mapfx2Loop de v7.6_mapa_camera (câmera seguindo,
   névoa, caminho até o destino e anel da rodinha), mais um por animação de câmera. Cada um lia o tamanho da tela e a
   câmera por conta própria, e os que rodavam depois do desenho deixavam bichos, névoa e caminho um quadro atrás do
   mapa. Agora o laço principal chama, a cada quadro: antesDoDesenhoMapa (com as posições visuais já postas por
   usarVisual), o desenho, e desenharCamadaMapa. */
import { TELAS, camera, dungeon, econ, world } from "../core/state.ts";
import { NEVOA, NOITE_MAPA } from "../data/mapa.ts";
import { luzDoDia } from "../render/luz_do_dia.ts";
import { explorarQuadro } from "./explorar.ts";
import { armadilhasQuadro } from "./armadilhas.ts";
import {
  CAMF,
  MAPFX2,
  SEGUIR,
  applyCameraTransform,
  constrainCamera,
  mapfx2Cv,
  nevoaCentros,
  nevoaRaio,
  passoCamera,
  segueHeroi,
} from "./camera.ts";
import { moverCameraRts } from "./selecao.ts";
import { enterCamp } from "../survival/acampamento.ts";
import { updateHeroPanelUI } from "../ui/painel.ts";
import { JOGO } from "../ui/modos.ts";
import { hudMinimap } from "../ui/hud.ts";
import { anyGameModal } from "../ui/titulo.ts";
import { posVisual } from "../render/interpolar.ts";
import { MAPCTL } from "./controle.ts";

/** A névoa em baixa resolução e a assinatura de quando foi desenhada (ver desenharCamadaMapa). */
const NEV = { cv: null as HTMLCanvasElement | null, sig: "", limpa: false, cam: "" };

/** No campo: solta as teclas do mapa e limpa a camada de cima uma vez. */
export function quadroMapaNoCampo(now: number) {
  MAPCTL.keys = {};
  passoCamera(now);
  if (NEV.limpa || !MAPFX2.cv || !MAPFX2.c) return;
  MAPFX2.c.setTransform(1, 0, 0, 1, 0, 0);
  MAPFX2.c.clearRect(0, 0, MAPFX2.cv.width, MAPFX2.cv.height);
  NEV.limpa = true;
}

/** Chegou no acampamento a pé (posições reais: chamar antes de usarVisual). */
export function chegadaAcampamento() {
  const h0 = world.heroes.find((h) => h._enterCamp && (h.state === "walking" || h.state === "field"));
  if (!h0 || !h0.camp || Math.hypot(h0.x - h0.camp.x, h0.y - h0.camp.y) >= 12) return;
  h0._enterCamp = false;
  h0.state = "idle";
  h0.x = h0.camp.x;
  h0.y = h0.camp.y;
  h0.walkTo = null;
  updateHeroPanelUI();
  enterCamp(h0);
}

/** A câmera do quadro: WASD/borda (RTS), animações (zoom, centralizar) e seguir a heroína. Com as posições visuais. */
export function antesDoDesenhoMapa(now: number, dt: number) {
  NEV.limpa = false;
  dt = Math.min(0.05, dt);
  try {
    moverCameraRts(dt);
  } catch (_) {}
  passoCamera(now);
  if (!econ.introDone) return;
  try {
    explorarQuadro(); // v8.3: o mapa explorado (map/explorar.ts) acompanha os heróis
    armadilhasQuadro(); // v8.3: aviso e disparo das armadilhas (map/armadilhas.ts)
  } catch (_) {}
  const h = segueHeroi();
  if (h && !SEGUIR.solto && !camera.zanim && !CAMF.anim && econ.campTut !== 1 && !anyGameModal()) {
    const vw = TELAS.viewport.clientWidth,
      vh = TELAS.viewport.clientHeight,
      tx = vw / 2 - h.x * camera.scale, // h.x já é a posição visual (render/interpolar.ts)
      ty = vh / 2 - h.y * camera.scale,
      k = 1 - Math.exp(-dt * SEGUIR.k);
    if (Math.abs(tx - camera.tx) + Math.abs(ty - camera.ty) > 0.5) {
      camera.tx += (tx - camera.tx) * k;
      camera.ty += (ty - camera.ty) * k;
      constrainCamera();
      applyCameraTransform();
    }
  }
}

/** A camada de cima do mapa (#map-nevoa): noite, névoa, caminho até o destino e anel da rodinha. Depois do desenho. */
export function desenharCamadaMapa(now: number) {
  // o retângulo da vista no minimapa acompanha a câmera (o HUD só o redesenhava 4 vezes por segundo)
  const cam = camera.scale + "|" + camera.tx + "|" + camera.ty;
  if (cam !== NEV.cam) {
    NEV.cam = cam;
    hudMinimap();
  }
  const c = mapfx2Cv();
  if (!c) return;
  const cv = MAPFX2.cv!,
    dpr = Math.min(2, window.devicePixelRatio || 1),
    vw = TELAS.viewport.clientWidth,
    vh = TELAS.viewport.clientHeight;
  if (cv.width !== Math.round(vw * dpr) || cv.height !== Math.round(vh * dpr)) {
    cv.width = Math.round(vw * dpr);
    cv.height = Math.round(vh * dpr);
  }
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, cv.width, cv.height);
  if (dungeon.active || !econ.introDone) return;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const S = (x: number, y: number) => [x * camera.scale + camera.tx, y * camera.scale + camera.ty];
  /* v8.0 — a noite: um véu azul por cima do mapa e das unidades (e um laranja no poente e na aurora) */
  const [escuro, poente] = luzDoDia();
  if (poente > 0.01) {
    c.fillStyle = NOITE_MAPA.corPoente + (NOITE_MAPA.poente * poente).toFixed(3) + ")";
    c.fillRect(0, 0, vw, vh);
  }
  if (escuro > 0.01) {
    c.fillStyle = NOITE_MAPA.cor + (NOITE_MAPA.forte * escuro).toFixed(3) + ")";
    c.fillRect(0, 0, vw, vh);
  }
  /* névoa: um borrão suave desenhado num canvas de 1/4 da resolução, refeito só quando muda (câmera, centros,
     tamanho), e esticado na tela */
  const R = nevoaRaio() * camera.scale,
    C = nevoaCentros();
  if (R < Math.hypot(vw, vh) * 1.2) {
    const q = 4,
      sig = Math.round(R) + "|" + vw + "x" + vh + "|" + C.map((p) => S(p.x, p.y).map(Math.round).join(",")).join(";");
    if (!NEV.cv) NEV.cv = document.createElement("canvas");
    const nc = NEV.cv;
    if (sig !== NEV.sig) {
      NEV.sig = sig;
      nc.width = Math.ceil(vw / q);
      nc.height = Math.ceil(vh / q);
      const n = nc.getContext("2d")!;
      n.setTransform(1 / q, 0, 0, 1 / q, 0, 0);
      n.fillStyle = NEVOA.cor + NEVOA.forte + ")";
      n.fillRect(0, 0, vw, vh);
      n.globalCompositeOperation = "destination-out";
      for (const p of C) {
        const [x, y] = S(p.x, p.y);
        if (x < -R || y < -R || x > vw + R || y > vh + R) continue;
        const g = n.createRadialGradient(x, y, R * (1 - NEVOA.borda), x, y, R);
        g.addColorStop(0, "rgba(0,0,0,1)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        n.fillStyle = g;
        n.beginPath();
        n.arc(x, y, R, 0, 6.283);
        n.fill();
      }
    }
    c.drawImage(nc, 0, 0, vw, vh);
  }
  /* caminho até o destino */
  for (const H of world.heroes) {
    if (H.state !== "walking" || !H.walkTo) continue;
    const hv = posVisual(H),
      [x0, y0] = S(hv.x, hv.y),
      [x1, y1] = S(H.walkTo.x, H.walkTo.y);
    if (Math.hypot(x1 - x0, y1 - y0) < 14) continue;
    c.save();
    c.setLineDash([5, 6]);
    c.lineDashOffset = -now / 60;
    c.strokeStyle = "rgba(255,236,190,.85)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
    c.setLineDash([]);
    c.strokeStyle = "#5a3d20";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x1, y1 - 16);
    c.stroke();
    c.fillStyle = "#e05a3a";
    c.beginPath();
    c.moveTo(x1, y1 - 16);
    c.lineTo(x1 + 10, y1 - 12.5);
    c.lineTo(x1, y1 - 9);
    c.fill();
    c.restore();
  }
  /* anel da rodinha: continue rolando para entrar no campo (v7.7: na heroína selecionada sob o cursor, JOGO.alvo) */
  const h = JOGO.alvo ? world.heroes.find((x) => x.id === JOGO.alvo) : null;
  if (h && JOGO.inPush > 0 && now - JOGO.inT < 700) {
    const hv = posVisual(h),
      [x, y] = S(hv.x, hv.y),
      k = Math.min(1, JOGO.inPush / 0.45);
    c.save();
    c.lineWidth = 5;
    c.strokeStyle = "rgba(0,0,0,.4)";
    c.beginPath();
    c.arc(x, y, 30, 0, 6.283);
    c.stroke();
    c.strokeStyle = "#9fe38a";
    c.beginPath();
    c.arc(x, y, 30, -Math.PI / 2, -Math.PI / 2 + k * 6.283);
    c.stroke();
    c.font = "600 12px Lora,serif";
    c.textAlign = "center";
    c.fillStyle = "#f6efd8";
    c.strokeStyle = "rgba(20,12,4,.8)";
    c.lineWidth = 3;
    const t = "🌲 continue rolando para entrar no campo";
    c.strokeText(t, x, y + 48);
    c.fillText(t, x, y + 48);
    c.restore();
  }
}
