/* ==== v7.7 — entrar e sair do campo pelo zoom, sem corte (documento mestre, Bloco 6 parte 3; decisões do mantenedor, 2026-10-17) ====
   Entrada: no zoom máximo do mapa, rolar para dentro com o cursor numa heroína selecionada (o anel enche) ou apertar
   E com uma heroína selecionada. A câmera do mapa vai até ela, o mapa continua aproximando (escala CSS da #viewport,
   sem redesenhar os ladrilhos), a tela escurece (#zoom-veu) e o campo abre com a câmera alta, que desce até a
   distância normal (CZ.voo em field/tipos.ts). No acampamento (heroína parada na base) entra no acampamento, como antes.
   Saída, o mesmo ao contrário: no campo, rolar para fora no mais afastado sobe a câmera aos poucos (CZ.saida, com a
   dica #saida-dica); no fim ela sobe de vez, a tela escurece e o mapa volta aproximado na heroína e se afasta.
   v8.1: chegando à fogueira no campo aberto, ela entra direto no acampamento (acampamentoDireto).
   Antes: o anel valia para a heroína seguida, em qualquer lugar da tela, e as duas trocas passavam pelo portal dourado. */
import { camera, dungeon, SEL, TELAS, world } from "../core/state.ts";
import { CZ } from "../field/tipos.ts";
import { JOGO, mapZoomLimit } from "../ui/modos.ts";
import { launchDungeon, exitDungeon } from "../expedicao/preparo.ts";
import { CPS, camZoomTo, enterCamp } from "../survival/acampamento.ts";
import { anyGameModal } from "../ui/titulo.ts";
import { mvToast } from "../ui/avisos.ts";
import { posVisual } from "../render/interpolar.ts";
import { MOB } from "../ui/celular.ts";
import { constrainCamera, applyCameraTransform } from "./camera.ts";
import { mapHero } from "./controle.ts";
import { cenaPronta } from "../render/gl/mundo_cena.ts";
import type { Hero } from "../core/tipos.ts";

const TRANS = {
  centrar: 300, // ms: a câmera do mapa vai até a heroína, no zoom máximo
  mergulho: 700, // ms: o mapa continua aproximando além do máximo
  mergulhoZoom: 2.6, // até quanto além do máximo (escala CSS)
  veu: 450, // ms: a tela escurece (termina junto com o mergulho)
  campoDe: 0.4, // a câmera do campo começa a 1/0,4 da distância normal…
  descida: 1100, // …e desce em tantos ms
  subida: 520, // ms: ao sair, a câmera do campo sobe e a tela escurece
  volta: 800, // ms: o mapa volta aproximado na heroína (voltaZoom) e se afasta até o zoom máximo…
  voltaZoom: 2.6,
  afasta: 700, // …e depois até o zoom de antes do campo
  raio: 26, // px da tela: o cursor está "na heroína" (anel e entrada pelo zoom)
  raioToque: 90, // idem, o centro da pinça no celular
  dicaAviso: 4000, // ms entre dois avisos de "selecione a heroína"
};
/** em: uma troca está acontecendo (ignora a roda e o E); avisoT: último aviso de seleção; fimT: fim da última troca. */
const TR = { em: false, avisoT: 0, fimT: 0 };

/** Pode entrar no campo (ou no acampamento) por aqui. */
const PODE = ["idle", "field", "walking"];

function veu() {
  let el = document.getElementById("zoom-veu");
  if (!el) {
    el = document.createElement("div");
    el.id = "zoom-veu";
    document.body.appendChild(el);
  }
  return el;
}
function veuPara(op: number, ms: number) {
  const el = veu();
  void el.offsetWidth; // aplica o estado atual antes da transição
  el.style.transition = "opacity " + ms + "ms ease";
  el.style.opacity = String(op);
}
/** Escala a #viewport inteira em volta de (ox, oy) da tela (k = 1 tira a escala). */
function escalarMapa(k: number, ms: number, curva: string, ox: number, oy: number) {
  const vp = TELAS.viewport;
  if (!vp) return;
  vp.style.transition = ms ? "transform " + ms + "ms " + curva : "none";
  vp.style.transformOrigin = ox + "px " + oy + "px";
  vp.style.transform = k === 1 ? "" : "scale(" + k + ")";
}

/** A heroína selecionada sob o ponto (cx, cy) da janela, que pode entrar no campo; ou null. */
export function heroiParaEntrar(cx: number, cy: number) {
  if (TR.em || dungeon.active) return null;
  const r = TELAS.viewport.getBoundingClientRect(),
    sx = cx - r.left,
    sy = cy - r.top;
  // no toque não há seleção (ela é do mouse): sem seleção, vale a heroína do mapa sob a pinça
  const ids = SEL.grupo.length || !MOB.on ? SEL.grupo : [mapHero()?.id];
  for (const id of ids) {
    const h = world.heroes.find((x) => x.id === id);
    if (!h || !PODE.includes(h.state)) continue;
    const p = posVisual(h);
    const raio = MOB.on ? TRANS.raioToque : TRANS.raio;
    if (Math.hypot(p.x * camera.scale + camera.tx - sx, p.y * camera.scale + camera.ty - sy) <= raio) return h;
  }
  return null;
}
/** Rolou para dentro no zoom máximo sem uma heroína selecionada sob o cursor: avisa de vez em quando. */
export function avisoEntrar() {
  const agora = performance.now();
  // durante a troca (a roda ainda girando) e logo depois dela, nada de aviso
  if (TR.em || dungeon.active || agora - TR.fimT < 1500 || agora - TR.avisoT < TRANS.dicaAviso) return;
  TR.avisoT = agora;
  mvToast("🌲 Para entrar no campo: selecione a heroína e role com o cursor nela (ou aperte E)");
}

/** E no mapa: entra com a heroína selecionada. */
export function entrarPeloE(hs: Hero[]) {
  const ok = hs.filter((h) => PODE.includes(h.state));
  if (ok.length === 1) entrarNoCampo(ok[0]);
  else if (ok.length > 1) mvToast("Selecione só uma heroína para entrar no campo");
  else mvToast("Selecione a heroína (clique nela) e aperte E para entrar no campo");
}

/** Mergulha do mapa no campo com a heroína `h` (parada na base: o acampamento, como antes). `cacada`: veio do fluxo
    de caça (map/cacada.ts), ela está caçando; recusada, volta a caçar. */
export function entrarNoCampo(h: Hero, cacada = false) {
  if (TR.em || dungeon.active || anyGameModal()) return;
  if (h.state === "idle") {
    enterCamp(h);
    return;
  }
  if (h.state !== "field" && h.state !== "walking" && !(cacada && h.state === "hunting")) return;
  const volta = cacada ? h.state : "field";
  TR.em = true;
  JOGO.inPush = 0;
  h.state = "idle";
  h.walkTo = null;
  h._enterCamp = false;
  JOGO.pending = true;
  JOGO.hero = h;
  JOGO.pos = { x: h.x, y: h.y };
  camZoomTo(h.x, h.y, camera.maxScale, TRANS.centrar, () => {
    const ox = h.x * camera.scale + camera.tx,
      oy = h.y * camera.scale + camera.ty;
    escalarMapa(TRANS.mergulhoZoom, TRANS.mergulho, "cubic-bezier(.55,0,.9,.45)", ox, oy);
    setTimeout(() => veuPara(1, TRANS.veu), TRANS.mergulho - TRANS.veu);
    setTimeout(() => {
      try {
        launchDungeon(h.id, true);
      } catch (e) {
        console.warn(e);
      }
      escalarMapa(1, 0, "", ox, oy);
      if (dungeon.active) CZ.voo = { de: TRANS.campoDe, ate: 1, t0: 0, ms: TRANS.descida };
      else {
        // recusada: ela volta ao mapa como estava
        JOGO.pending = false;
        h.state = volta;
      }
      // o véu clareia quando o campo desenha o primeiro quadro (CZ.voo.t0 posto por cravZoom), ou em 2 s (sem WebGL)
      const ini = performance.now(),
        clarear = () => {
          const v = CZ.voo;
          if (dungeon.active && v && v.t0 <= 0 && performance.now() - ini < 2500) {
            requestAnimationFrame(clarear);
            return;
          }
          veuPara(0, TRANS.descida * 0.7);
          TR.em = false;
          TR.fimT = performance.now();
        };
      clarear();
    }, TRANS.mergulho + 30);
  });
}

/** v8.0 — do campo atual (a cena inicial) direto para o campo aberto em `p` do mapa, sem passar pelo mapa: a tela
    escurece, troca e clareia quando o campo novo desenha. `depois` roda com o campo novo aberto. */
export function campoDireto(h: Hero, p: { x: number; y: number }, depois?: () => void) {
  if (TR.em) return;
  TR.em = true;
  veuPara(1, TRANS.veu);
  setTimeout(() => {
    try {
      if (dungeon.active) exitDungeon(() => {}); // `suave`: fecha na hora, sem o portal
      h.x = p.x;
      h.y = p.y;
      h.state = "idle";
      h.walkTo = null;
      h.task = null;
      h._enterCamp = false;
      JOGO.pending = true;
      JOGO.hero = h;
      JOGO.pos = { x: p.x, y: p.y };
      launchDungeon(h.id, true);
      if (!dungeon.active) {
        JOGO.pending = false;
        h.state = "field";
      } else if (depois) depois();
    } catch (e) {
      console.warn(e);
    }
    // clareia quando o cenário em volta dela está montado (render/gl/mundo_cena.ts), ou em 1,5 s
    const ini = performance.now();
    let quadros = 0;
    const clarear = () => {
      if (quadros++ < 3 || (!cenaPronta() && performance.now() - ini < 1500)) {
        requestAnimationFrame(clarear);
        return;
      }
      veuPara(0, TRANS.descida * 0.7);
      TR.em = false;
      TR.fimT = performance.now();
    };
    requestAnimationFrame(clarear);
  }, TRANS.veu + 30);
}

/** v8.1 — do campo aberto direto para a cena do acampamento (ela chegou à fogueira, field/acampamento_campo.ts): a
    tela escurece e o acampamento abre, sem subir ao mapa. A câmera do mapa fica no acampamento (CPS.prevCam), para
    quando ela sair dele. */
export function acampamentoDireto(h: Hero) {
  if (TR.em || !h.camp) return;
  TR.em = true;
  veuPara(1, TRANS.veu);
  setTimeout(() => {
    try {
      if (dungeon.active) exitDungeon(() => {}); // `suave`: fecha na hora, sem o portal
      h.x = h.camp.x;
      h.y = h.camp.y;
      h.state = "idle";
      h.walkTo = null;
      h.task = null;
      h._enterCamp = false;
      JOGO.pending = false;
      const vp = TELAS.viewport,
        s = Math.min(camera.maxScale * 0.8, Math.max(mapZoomLimit() * 2.2, camera.minScale * 12));
      camera.zt = null;
      camera.scale = s;
      camera.tx = vp.clientWidth / 2 - h.x * s;
      camera.ty = vp.clientHeight / 2 - h.y * s;
      constrainCamera();
      applyCameraTransform();
      CPS.prevCam = { s: camera.scale, x: camera.tx, y: camera.ty };
      CPS.pending = true;
      launchDungeon(h.id, true);
      if (!dungeon.active) h.state = "idle"; // recusada: ela fica na base, no mapa
    } catch (e) {
      console.warn(e);
    }
    let quadros = 0;
    const clarear = () => {
      if (quadros++ < 3) {
        requestAnimationFrame(clarear);
        return;
      }
      veuPara(0, TRANS.descida * 0.7);
      TR.em = false;
      TR.fimT = performance.now();
    };
    requestAnimationFrame(clarear);
  }, TRANS.veu + 30);
}

/** Sobe do campo (ou do acampamento) para o mapa. */
export function sairDoCampo() {
  const d = dungeon;
  if (TR.em || !d.active || d.dead || d.modalOpen || d.invOpen) return;
  if (d.mode !== "campo" && !d.camp) return;
  TR.em = true;
  dicaSaida(0);
  CZ.voo = { de: CZ.f / (CZ.jog || 1), ate: TRANS.campoDe, t0: performance.now(), ms: TRANS.subida };
  CZ.saida = 0;
  veuPara(1, TRANS.subida);
  setTimeout(() => {
    let voltou = false;
    try {
      exitDungeon((fx, fy, s) => {
        voltou = true;
        voltarAoMapa(fx, fy, s);
      });
    } catch (e) {
      console.warn(e);
    }
    CZ.voo = null;
    if (!voltou) veuPara(0, TRANS.volta * 0.8); // acampamento: a câmera de antes volta sozinha (exitDungeon)
    TR.em = false;
    TR.fimT = performance.now();
  }, TRANS.subida + 30);
}
/** O mapa aparece aproximado na heroína (fx, fy) e se afasta até o zoom máximo, depois até `s`. */
function voltarAoMapa(fx: number, fy: number, s: number) {
  const vw = TELAS.viewport.clientWidth,
    vh = TELAS.viewport.clientHeight;
  camera.zt = null;
  camera.scale = camera.maxScale;
  camera.tx = vw / 2 - fx * camera.scale;
  camera.ty = vh / 2 - fy * camera.scale;
  constrainCamera();
  applyCameraTransform();
  const ox = fx * camera.scale + camera.tx,
    oy = fy * camera.scale + camera.ty;
  escalarMapa(TRANS.voltaZoom, 0, "", ox, oy);
  void TELAS.viewport.offsetWidth;
  escalarMapa(1, TRANS.volta, "cubic-bezier(.1,.55,.45,1)", ox, oy);
  veuPara(0, TRANS.volta * 0.8);
  setTimeout(() => {
    if (!dungeon.active) camZoomTo(fx, fy, s, TRANS.afasta);
  }, TRANS.volta);
}

/** A dica da saída no campo: p = quanto a roda já juntou (0 esconde). */
export function dicaSaida(p: number) {
  const v = document.getElementById("dungeon-view");
  if (!v) return;
  let el = document.getElementById("saida-dica");
  if (!el) {
    el = document.createElement("div");
    el.id = "saida-dica";
    el.innerHTML = "<i></i><span>🗺 continue rolando para voltar ao mapa</span>";
    v.appendChild(el);
  }
  el.style.setProperty("--p", String(Math.min(1, p)));
  el.classList.toggle("on", p > 0);
}
