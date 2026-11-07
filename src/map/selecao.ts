/* ==== v7.7 — controle do mapa estilo RTS (documento mestre 7.1/7.3; decisões do mantenedor, 2026-10-17) ====
   Mouse (no celular continua o toque de antes: arrastar move o mapa, tocar no chão anda):
   · Esquerdo: clique seleciona o herói (clicar de novo nele abre o menu dele) ou inspeciona o que estiver ali (bicho,
     recurso, cidade…); clique no chão vazio limpa a seleção. Arrastar no chão desenha a caixa de seleção (SEL.grupo).
   · Direito: ordem para os selecionados (sem seleção, para a heroína do mapa): numa pedra/árvore pronta, coletar (o
     minijogo abre quando o primeiro chega: task.mg, minijogoNaChegada); v7.7 (2026-10-18): num coelho/cervo/pato/
     águia, caçar essa espécie ali (mandarCacar; coelho e cervo viram caçada no campo, map/cacada.ts); na água, pescar;
     no acampamento, ir para lá; no resto, andar. Um marcador mostra onde foi a ordem. Com seleção, a dica ao lado do
     cursor (#ordem-dica, alvoOrdem) diz o que o botão direito faz ali, com os verbos de ORDEM (data/mapa.ts).
   · Meio arrastando: move a câmera. Mouse encostado na borda da janela também (RTS.borda).
   Teclado: WASD/setas movem a câmera (moverCameraRts, chamado pelo laço do mapa), Espaço centraliza nos selecionados,
   F liga/desliga a câmera seguindo a heroína (SEGUIR; começa livre), Ctrl+1..9 guarda a seleção num grupo, 1..9
   seleciona o grupo (dois toques: centraliza), Esc limpa (ui/titulo.ts). C e V continuam centralizando o acampamento
   e o personagem (v5.9.05). */
import { world, camera, dungeon, SEL, JANELAS, TELAS } from "../core/state.ts";
import { MG_DEFS } from "../data/minigames.ts";
import { MAP_KEYS, RTS, ORDEM, HUNT_AREA_R, verboTrabalho } from "../data/mapa.ts";
import { snapToLand } from "../sim/animais.ts";
import { isWaterCell } from "./agua.ts";
import { pickNodeAt } from "../sim/fauna.ts";
import { nodeReady } from "./recursos.ts";
import { pushEvent } from "../sim/eventos.ts";
import { mvToast } from "../ui/avisos.ts";
import { updateHeroPanelUI } from "../ui/painel.ts";
import { huntLabel } from "../render/sprites.ts";
import { startMinigame, workVerb, fishSpot } from "../minijogos/trabalho.ts";
import { MAPCTL, mapGoCamp, mapHero } from "./controle.ts";
import { SEGUIR, segueBtn, constrainCamera, applyCameraTransform } from "./camera.ts";
import { nearCamp, camZoomTo } from "../survival/acampamento.ts";
import { anyGameModal } from "../ui/titulo.ts";
import { posVisual } from "../render/interpolar.ts";
import { entrarPeloE } from "./transicao.ts";
import { musgoCity } from "./vila_musgo.ts";
import { vilaIr } from "./vila_cena.ts";
import type { Hero, Ponto } from "../core/tipos.ts";

/** Quem pode receber comando (fora do campo, de viagem ao mercado e de expedição). */
const LIVRES = ["idle", "field", "walking", "traveling", "hunting", "returning"];

function grupoSelecionado(): Hero[] {
  return SEL.grupo.map((id) => world.heroes.find((h) => h.id === id)).filter((h): h is Hero => !!h);
}
function selecionar(hs: Hero[]) {
  SEL.grupo = hs.map((h) => h.id);
  avisoSelecao();
}
/** v8.1 — o cartão do clã (ui/painel.ts): seleciona só ela, como o clique nela no mapa. */
export function selecionarHeroi(h: Hero) {
  selecionar([h]);
  MAPCTL.sel = h.id;
}
export function limparSelecao() {
  if (!SEL.grupo.length) return;
  SEL.grupo = [];
  avisoSelecao();
}
function avisoSelecao() {
  let el = document.getElementById("sel-grupo");
  if (!el) {
    el = document.createElement("div");
    el.id = "sel-grupo";
    TELAS.viewport.appendChild(el);
  }
  const hs = grupoSelecionado();
  el.style.display = hs.length ? "block" : "none";
  // v8.1: curto (o painel do clã mostra as ordens); o resto dos atalhos fica na dica do cursor e no ❓
  el.innerHTML = hs.length
    ? "<b>" +
      (hs.length <= 3 ? hs.map((h) => h.name).join(", ") : hs.length + " personagens") +
      "</b> · <kbd>botão direito</kbd> dá a ordem · <kbd>E</kbd> joga com ela · <kbd>Esc</kbd> limpa"
    : "";
  updateHeroPanelUI(); // o painel do clã mostra as ordens de quem está selecionado
}

/** Heróis dentro do retângulo (mundo). */
function heroisNoRetangulo(x0: number, y0: number, x1: number, y1: number) {
  const [ax, bx] = x0 < x1 ? [x0, x1] : [x1, x0],
    [ay, by] = y0 < y1 ? [y0, y1] : [y1, y0];
  return world.heroes.filter((h) => LIVRES.includes(h.state) && h.x >= ax && h.x <= bx && h.y >= ay && h.y <= by);
}

/** Manda os heróis coletarem `kind` em (x, y); o primeiro a chegar abre o minijogo (se o recurso tiver um). */
function mandarColetar(hs: Hero[], kind: string, x: number, y: number) {
  const p = kind === "fish" ? { x, y } : snapToLand(x, y); // pesca: o ponto da margem (fishSpot)
  if (!p) return;
  const ok = hs.filter((h) => LIVRES.includes(h.state));
  ok.forEach((h, i) => {
    const naBase = h.state === "idle";
    h.huntSpecies = kind;
    h.task = {
      x: p.x + (i ? Math.cos(i * 2.4) * 6 : 0),
      y: p.y + (i ? Math.sin(i * 2.4) * 6 : 0),
      targetSpecies: kind,
      killsWanted: 99999,
      killsDone: 0,
      maxMin: (h.huntHours || 6) * 60,
      field: !naBase,
      mg: !!MG_DEFS[kind],
    };
    h.state = "traveling";
    h.walkTo = null;
    h.targetEntity = null;
    h.localTarget = null;
  });
  if (ok.length)
    pushEvent(
      (ok.length === 1 ? ok[0].name : ok.map((h) => h.name).join(", ")) +
        " foi " +
        workVerb(kind) +
        huntLabel(kind) +
        (MG_DEFS[kind] ? " — o minijogo abre quando chegar." : "."),
    );
  updateHeroPanelUI();
}
/** Manda os heróis andarem até (x, y), espalhados um pouco em volta. */
function mandarAndar(hs: Hero[], x: number, y: number) {
  const ok = hs.filter((h) => LIVRES.includes(h.state));
  let foi = 0;
  ok.forEach((h, i) => {
    const p = snapToLand(x + (i ? Math.cos(i * 2.4) * 8 : 0), y + (i ? Math.sin(i * 2.4) * 8 : 0));
    if (!p) return;
    h.walkTo = { x: p.x, y: p.y };
    h.task = null;
    h.targetEntity = null;
    h.state = "walking";
    h._enterCamp = false;
    foi++;
  });
  if (!foi) mvToast("Escolha um ponto em terra");
  updateHeroPanelUI();
  return foi > 0;
}

/** Herói sob o cursor (raio na tela). */
function heroiEm(wx: number, wy: number) {
  const r = Math.max(10, 16 / camera.scale);
  return world.heroes.find((h) => h.state !== "indungeon" && Math.hypot(h.x - wx, h.y - wy) < r) || null;
}

/**
 * Clique esquerdo no mapa (mouse). true = tratado aqui (o clique não segue para os inspetores e menus).
 * Num herói: o primeiro clique seleciona; clicar de novo no mesmo herói segue para o menu dele (como antes).
 * Fora de um herói: segue para os inspetores; no chão vazio também limpa a seleção.
 */
export function cliqueComSelecao(wx: number, wy: number, vazio: boolean) {
  const heroi = heroiEm(wx, wy);
  if (heroi) {
    if (SEL.grupo.length === 1 && SEL.grupo[0] === heroi.id) return false;
    selecionar([heroi]);
    MAPCTL.sel = heroi.id;
    return true;
  }
  if (vazio) limparSelecao();
  return false;
}

/** Botão direito: a ordem para os selecionados (sem seleção, para a heroína do mapa). */
function ordem(wx: number, wy: number) {
  let hs = grupoSelecionado().filter((h) => h.state !== "indungeon");
  if (!hs.length) {
    const h = mapHero();
    if (!h) return;
    hs = [h];
    selecionar(hs);
  }
  const a = alvoOrdem(wx, wy);
  if (a.tipo === "esgotado") {
    mvToast(a.kind === "tree" ? "Essa árvore ainda está se recuperando" : "Essa pedra já foi coletada");
    return;
  }
  if (a.tipo === "coletar" || a.tipo === "pescar") {
    mandarColetar(hs, a.kind!, a.x, a.y);
    marcarOrdem(a.x, a.y, "coletar");
    return;
  }
  if (a.tipo === "cacar") {
    mandarCacar(hs, a.kind!, a.x, a.y);
    marcarOrdem(a.x, a.y, "cacar");
    return;
  }
  if (a.tipo === "acampamento") {
    for (const h of hs) mapGoCamp(h);
    marcarOrdem(wx, wy, "andar");
    return;
  }
  if (a.tipo === "vila") {
    vilaIr(hs[0]); // v8.0: a vila andável (uma heroína entra; a cena é de uma só)
    marcarOrdem(wx, wy, "andar");
    return;
  }
  if (mandarAndar(hs, wx, wy)) marcarOrdem(wx, wy, "andar");
}

/** v7.7 — o que o botão direito faria em (wx, wy): o mesmo alvo dá a ordem e a dica do cursor. */
interface AlvoOrdem {
  tipo: "coletar" | "esgotado" | "cacar" | "pescar" | "acampamento" | "vila" | "andar";
  kind?: string;
  x: number;
  y: number;
  rotulo: string;
}
const CACAVEIS = ["rabbit", "deer", "wolf", "boar"],
  AVES = ["duck", "eagle", "fox"]; // os de world.wild (v8.0: a raposa também)
function alvoOrdem(wx: number, wy: number): AlvoOrdem {
  // v8.1: o acampamento vem antes de tudo: o clique ali é para voltar (mesmo com um recurso antigo em cima)
  if (nearCamp(wx, wy)) return { tipo: "acampamento", x: wx, y: wy, rotulo: "⛺ Voltar ao acampamento" };
  const n = pickNodeAt(wx, wy);
  if (n) {
    if (!nodeReady(n))
      return {
        tipo: "esgotado",
        kind: n.kind,
        x: n.x,
        y: n.y,
        rotulo: n.kind === "tree" ? "🪓 árvore se recuperando" : "⛏ pedra já coletada",
      };
    return { tipo: "coletar", kind: n.kind, x: n.x, y: n.y, rotulo: verboTrabalho(n.kind) };
  }
  // bicho sob o cursor (raio na tela): a caça é dessa espécie, ali
  const r = Math.max(6, ORDEM.raioBicho / camera.scale);
  let b: { species: string; x: number; y: number } | null = null,
    bd = r;
  for (const o of world.animals)
    if (o.alive !== false && CACAVEIS.includes(o.species)) {
      const d = Math.hypot(o.x - wx, o.y - wy);
      if (d < bd) {
        bd = d;
        b = o;
      }
    }
  for (const o of world.wild || [])
    if (o.alive && AVES.includes(o.species) && o.state !== "fly") {
      const d = Math.hypot(o.x - wx, o.y - wy);
      if (d < bd) {
        bd = d;
        b = o;
      }
    }
  if (b) return { tipo: "cacar", kind: b.species, x: b.x, y: b.y, rotulo: verboTrabalho(b.species) };
  {
    const v = musgoCity(); // v8.0: a vila andável
    if (v && Math.hypot(v.x - wx, v.y - 12 - wy) < Math.max(14, 22 / camera.scale))
      return { tipo: "vila", x: wx, y: wy, rotulo: "🏘 Entrar na Vila Musgo" };
  }
  if (isWaterCell(wx, wy)) {
    const p = fishSpot(wx, wy);
    if (p) return { tipo: "pescar", kind: "fish", x: p.x, y: p.y, rotulo: verboTrabalho("fish") };
  }
  return { tipo: "andar", x: wx, y: wy, rotulo: "🚶 Andar" };
}
/** Manda os heróis caçarem `kind` em volta de (x, y): a área de caça (HUNT_AREA_R) começa ali. */
function mandarCacar(hs: Hero[], kind: string, x: number, y: number) {
  const ok = hs.filter((h) => LIVRES.includes(h.state));
  ok.forEach((h, i) => {
    const hrs = h.huntHours || 6,
      p = snapToLand(x + (i ? Math.cos(i * 2.4) * 6 : 0), y + (i ? Math.sin(i * 2.4) * 6 : 0)) || { x, y };
    h.huntSpecies = kind;
    h.task = {
      x: p.x,
      y: p.y,
      ox: p.x,
      oy: p.y,
      r: HUNT_AREA_R(hrs),
      targetSpecies: kind,
      killsWanted: 99999,
      killsDone: 0,
      maxMin: hrs * 60,
      field: h.state !== "idle",
    };
    h.state = "traveling";
    h.walkTo = null;
    h.targetEntity = null;
    h.localTarget = null;
  });
  if (ok.length)
    pushEvent(
      (ok.length === 1 ? ok[0].name : ok.map((h) => h.name).join(", ")) +
        " foi " +
        workVerb(kind) +
        huntLabel(kind) +
        " ali (" +
        (ok[0].huntHours || 6) +
        "h).",
    );
  updateHeroPanelUI();
}

/** Dica do cursor com seleção: o que o botão direito faz ali. */
function dicaOrdem(e: PointerEvent | null, mundo: ((cx: number, cy: number) => Ponto) | null) {
  let el = document.getElementById("ordem-dica");
  const hs = e && mundo && CAM.noMapa && !dungeon.active && !anyGameModal() ? grupoSelecionado() : [];
  if (!hs.length || !e || !mundo) {
    if (el) el.classList.remove("on");
    TELAS.viewport?.removeAttribute("data-ordem");
    return;
  }
  if (!el) {
    el = document.createElement("div");
    el.id = "ordem-dica";
    document.body.appendChild(el);
  }
  const w = mundo(e.clientX, e.clientY),
    a = alvoOrdem(w.x, w.y);
  const txt = a.rotulo + (a.tipo === "esgotado" ? "" : " · botão direito");
  if (el.textContent !== txt) el.textContent = txt;
  el.style.left = e.clientX + 16 + "px";
  el.style.top = e.clientY + 18 + "px";
  el.classList.add("on");
  el.classList.toggle("fraca", a.tipo === "andar" || a.tipo === "esgotado");
  TELAS.viewport.setAttribute("data-ordem", a.tipo);
}
/** Marcador da ordem no chão (some sozinho). */
function marcarOrdem(wx: number, wy: number, tipo: string) {
  const st = document.getElementById("stage");
  if (!st) return;
  const p = document.createElement("div");
  p.className = "ordem-ping " + tipo;
  p.style.left = wx + "px";
  p.style.top = wy + "px";
  p.style.setProperty("--k", (1 / Math.max(0.2, camera.scale)).toFixed(3));
  st.appendChild(p);
  setTimeout(() => p.remove(), 700);
}

/** Chamado quando um herói com task.mg chega: abre o minijogo se dá (nada aberto, sem espera); senão trabalha sozinho. */
export function minijogoNaChegada(h: Hero) {
  const t = h.task;
  if (!t || !t.mg) return;
  t.mg = false;
  // os outros do mesmo comando trabalham sozinhos
  for (const o of world.heroes)
    if (o !== h && o.task && o.task.mg && o.task.targetSpecies === t.targetSpecies) o.task.mg = false;
  const livre = !JANELAS.mg && !dungeon.active && !(h.mgUntil && h.mgUntil > world.tick);
  if (!livre) return;
  startMinigame(h, t.targetSpecies);
  // depois do minijogo, a coleta foi esta: volta (fica no lugar se já estava fora da base)
  h.state = "returning";
}

/** Anel em volta dos selecionados (contexto do mapa, em coordenadas do mundo). */
export function desenharSelecao(ctx: CanvasRenderingContext2D) {
  const hs = grupoSelecionado();
  if (!hs.length) return;
  const t = performance.now() / 1000;
  ctx.save();
  ctx.lineWidth = 1.6 / Math.max(0.5, camera.scale) + 0.6;
  for (const h of hs) {
    if (h.state === "indungeon") continue;
    ctx.strokeStyle = "rgba(120,230,140," + (0.75 + 0.25 * Math.sin(t * 4)) + ")";
    ctx.beginPath();
    ctx.ellipse(h.x, h.y + 4, 11, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------- câmera: teclado e borda da tela ---------- */
const CAM = { vx: 0, vy: 0, mx: -1, my: -1, noMapa: false, grupoT: 0, grupoK: "" };
/** Move a câmera pelo WASD/setas e pela borda da janela (o laço do mapa chama a cada quadro). */
export function moverCameraRts(dt: number) {
  let dx = 0,
    dy = 0;
  if (!anyGameModal()) {
    for (const k in MAPCTL.keys) {
      const v = MAP_KEYS[k];
      if (v) {
        dx += v[0];
        dy += v[1];
      }
    }
    if (CAM.noMapa && CAM.mx >= 0) {
      const b = RTS.borda;
      if (CAM.mx <= b) dx -= 1;
      else if (CAM.mx >= innerWidth - 1 - b) dx += 1;
      if (CAM.my <= b) dy -= 1;
      else if (CAM.my >= innerHeight - 1 - b) dy += 1;
    }
  }
  const L = Math.hypot(dx, dy) || 1,
    k = 1 - Math.exp(-dt * RTS.acel),
    alvoX = (dx / L) * RTS.vel,
    alvoY = (dy / L) * RTS.vel;
  CAM.vx += (alvoX - CAM.vx) * k;
  CAM.vy += (alvoY - CAM.vy) * k;
  if (Math.abs(CAM.vx) + Math.abs(CAM.vy) < 2) {
    CAM.vx = CAM.vy = 0;
    return;
  }
  if (dx || dy) soltarCamera();
  camera.tx -= CAM.vx * dt;
  camera.ty -= CAM.vy * dt;
  constrainCamera();
  applyCameraTransform();
}
/** O jogador moveu a câmera: ela para de seguir a heroína. */
function soltarCamera() {
  if (SEGUIR.solto) return;
  SEGUIR.solto = true;
  segueBtn(true);
}
/** Centraliza a câmera (sem mudar o zoom) no meio dos heróis. */
function centralizar(hs: Hero[]) {
  if (!hs.length) return;
  let x = 0,
    y = 0;
  for (const h of hs) {
    const p = posVisual(h);
    x += p.x;
    y += p.y;
  }
  camZoomTo(x / hs.length, y / hs.length, camera.scale, 320);
}
function teclaRts(e: KeyboardEvent) {
  if (dungeon.active || e.altKey || e.metaKey || anyGameModal()) return;
  const t = e.target as HTMLElement;
  if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
  const app = document.getElementById("app");
  if (!app || app.style.display === "none" || document.getElementById("title-screen")?.offsetParent) return;
  if (e.code === "Space") {
    e.preventDefault();
    const hs = grupoSelecionado().filter((h) => h.state !== "indungeon"),
      h = mapHero();
    centralizar(hs.length ? hs : h ? [h] : []);
    return;
  }
  // v7.7: E entra no campo com a heroína selecionada (map/transicao.ts)
  if (e.code === "KeyE" && !e.repeat && !e.ctrlKey) {
    entrarPeloE(grupoSelecionado());
    return;
  }
  if (e.code === "KeyF" && !e.repeat) {
    SEGUIR.solto = !SEGUIR.solto;
    segueBtn(SEGUIR.solto);
    mvToast(SEGUIR.solto ? "📷 Câmera livre (F segue de novo)" : "📍 Câmera seguindo a heroína");
    return;
  }
  const m = /^Digit([1-9])$/.exec(e.code);
  if (!m || e.repeat) return;
  const k = m[1];
  if (e.ctrlKey) {
    e.preventDefault();
    if (!SEL.grupo.length) return;
    SEL.grupos[k] = SEL.grupo.slice();
    mvToast("Grupo " + k + " guardado (" + SEL.grupo.length + ")");
    return;
  }
  const ids = SEL.grupos[k];
  if (!ids || !ids.length) return;
  selecionar(ids.map((id) => world.heroes.find((h) => h.id === id)).filter((h): h is Hero => !!h));
  const agora = performance.now();
  if (CAM.grupoK === k && agora - CAM.grupoT < RTS.duplo) centralizar(grupoSelecionado());
  CAM.grupoK = k;
  CAM.grupoT = agora;
}

/** Liga o controle do mouse e do teclado no mapa. Chamado por iniciarSelecao(). */
export function ligarSelecao() {
  const vp = document.getElementById("viewport")!, // (TELAS.viewport ainda não foi preenchido nesta hora)
    caixa = document.createElement("div");
  caixa.id = "sel-caixa";
  vp.appendChild(caixa);
  let ini: { x: number; y: number } | null = null,
    emCaixa = false,
    arrasto: { x: number; y: number } | null = null;
  const mundo = (cx: number, cy: number) => {
    const r = vp.getBoundingClientRect();
    return { x: (cx - r.left - camera.tx) / camera.scale, y: (cy - r.top - camera.ty) / camera.scale };
  };
  const desenhar = (e: PointerEvent) => {
    const r = vp.getBoundingClientRect(),
      x0 = Math.min(ini!.x, e.clientX) - r.left,
      y0 = Math.min(ini!.y, e.clientY) - r.top;
    caixa.style.left = x0 + "px";
    caixa.style.top = y0 + "px";
    caixa.style.width = Math.abs(e.clientX - ini!.x) + "px";
    caixa.style.height = Math.abs(e.clientY - ini!.y) + "px";
  };
  /** O evento é do mouse, no mapa (não num botão ou painel dentro da #viewport). */
  const doMapa = (e: PointerEvent | MouseEvent) =>
    (!("pointerType" in e) || e.pointerType === "mouse") &&
    !dungeon.active &&
    !(e.target as HTMLElement).closest("button,input,select,a,#sel-grupo,#segue-btn,.cam-ping");
  // fase de captura: o arrastar antigo do mapa (intro/cinematica.ts) e o clique para andar (v6.4) ficam só no toque
  vp.addEventListener(
    "pointerdown",
    (e) => {
      if (!doMapa(e)) return;
      if (e.button === 0) {
        ini = { x: e.clientX, y: e.clientY };
        emCaixa = false;
      } else if (e.button === 1) {
        e.preventDefault();
        arrasto = { x: e.clientX, y: e.clientY };
        vp.classList.add("arrastando");
      }
      e.stopPropagation();
      try {
        vp.setPointerCapture(e.pointerId);
      } catch (_) {}
    },
    true,
  );
  vp.addEventListener(
    "pointermove",
    (e) => {
      if (arrasto) {
        e.stopPropagation();
        camera.tx += e.clientX - arrasto.x;
        camera.ty += e.clientY - arrasto.y;
        arrasto = { x: e.clientX, y: e.clientY };
        soltarCamera();
        constrainCamera();
        applyCameraTransform();
        return;
      }
      if (!ini) return;
      e.stopPropagation();
      if (!emCaixa && Math.hypot(e.clientX - ini.x, e.clientY - ini.y) > RTS.arrasto) {
        emCaixa = true;
        caixa.style.display = "block";
      }
      if (emCaixa) desenhar(e);
    },
    true,
  );
  vp.addEventListener(
    "pointerup",
    (e) => {
      if (arrasto) {
        e.stopPropagation();
        arrasto = null;
        vp.classList.remove("arrastando");
        return;
      }
      if (!ini) return;
      const a = mundo(ini.x, ini.y),
        b = mundo(e.clientX, e.clientY),
        caixaFeita = emCaixa;
      ini = null;
      emCaixa = false;
      if (!caixaFeita) return; // clique simples: segue para a seleção e os inspetores (intro/cinematica.ts)
      e.stopPropagation();
      caixa.style.display = "none";
      const hs = heroisNoRetangulo(a.x, a.y, b.x, b.y);
      if (hs.length) selecionar(hs);
      else limparSelecao();
    },
    true,
  );
  vp.addEventListener(
    "contextmenu",
    (e) => {
      if (!doMapa(e) || anyGameModal()) return;
      e.preventDefault();
      e.stopPropagation();
      const w = mundo(e.clientX, e.clientY);
      ordem(w.x, w.y);
    },
    true,
  );
  // posição do mouse para mover a câmera pela borda (só com o cursor no mapa, não num painel)
  window.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    CAM.mx = e.clientX;
    CAM.my = e.clientY;
    const el = e.target as HTMLElement;
    CAM.noMapa = !!el && (el === vp || (vp.contains(el) && !el.closest("button,#sel-grupo,#segue-btn")));
    dicaOrdem(ini || arrasto ? null : e, mundo); // v7.7: o que o botão direito faz ali
  });
  document.addEventListener("mouseleave", () => {
    CAM.mx = -1;
    dicaOrdem(null, null);
  });
  window.addEventListener("blur", () => (CAM.mx = -1));
  window.addEventListener("keydown", teclaRts);
}
