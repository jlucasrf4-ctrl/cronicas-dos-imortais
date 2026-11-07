/* ==== v8.1 — o acampamento visto do campo aberto (mantenedor, 2026-10-30: "dá pra ver no mapa (jogo) o acampamento
   chegando pra o jogador entender a transição do modo jogo pro modo acampamento"; opção A) ====
   No lugar do acampamento no mapa (campPos), o campo aberto tem uma clareira (sem árvore, mato e capim:
   render/gl/mundo_cena.ts pergunta naClareira) com os mesmos objetos da cena do acampamento (mbPropsAcampamento), a
   fogueira acesa, uma coluna de fumaça que se vê de longe e o Caçador esperando. Chegando à fogueira
   (ACAMP_CAMPO.entrada), a tela escurece e abre a cena do acampamento (map/transicao.ts acampamentoDireto), sem subir
   ao mapa. Só conta quem veio de fora: abrir o campo já dentro da clareira não puxa para dentro. Com o acampamento
   perto e fora do quadro, um marcador na borda da tela aponta para ele (CSS 58_v8.1_acampamento_campo.css). */
import { GL3, dungeon, econ, TELAS } from "../core/state.ts";
import { D3 } from "./projecao.ts";
import { ACAMP_CAMPO } from "../data/campo.ts";
import { MUNDO, cantoCampo } from "../map/mundo.ts";
import { acampamentoDireto } from "../map/transicao.ts";
import { M4, MALHA } from "../render/gl/geometria.ts";
import { MB, glMesh, mbIco } from "../render/gl/malhas.ts";
import { glPush } from "../render/gl/renderer.ts";
import { alturaChao } from "../render/gl/mundo_cena.ts";
import { campPos, chamasGLPush, mbPropsAcampamento } from "../survival/acampamento.ts";
import { npcGL } from "../intro/cena.ts";
import { setBanner } from "./masmorra.ts";
import type { GLMesh, Ponto } from "../core/tipos.ts";

/** props: a malha dos objetos (fogueira em 0,0); fumaca: um rolo de fumaça; fora: ela estava fora da entrada no
    último quadro; viu: o aviso "acampamento à vista" já saiu nesta sessão do campo. */
const AC = {
  props: null as GLMesh | null,
  fumaca: null as GLMesh | null,
  sess: -1,
  fora: false,
  viu: false,
  npc: { x: 0, y: 0, yaw: Math.PI / 2, ph: 0 },
};

/** A fogueira do acampamento em coordenadas absolutas do campo (mapa / escala); null fora do campo aberto. */
function fogueiraNoCampo(): Ponto | null {
  const p = campPos();
  return p && dungeon.origem ? { x: p.x / MUNDO.escala, y: p.y / MUNDO.escala } : null;
}

/** (fx, fz) absoluto está na clareira do acampamento (mais `folga` px). */
export function naClareira(fx: number, fz: number, folga = 0) {
  const F = fogueiraNoCampo();
  return !!F && Math.hypot(fx - F.x, fz - F.y) < ACAMP_CAMPO.clareira * dungeon.tile + folga;
}

/** Distância (px do campo) da heroína à fogueira; Infinity fora do campo aberto. */
export function distFogueira() {
  const F = fogueiraNoCampo(),
    c = cantoCampo();
  return F && c ? Math.hypot(dungeon.px + c.x - F.x, dungeon.py + c.y - F.y) : Infinity;
}

function malhaProps() {
  if (!AC.props) {
    const T = dungeon.tile,
      o = MB();
    MALHA._gs = 515; // a mesma sorte da cena do acampamento: os objetos ficam iguais
    mbPropsAcampamento(o, { x: 0, y: 0 }, { x: T * 1.7, y: -T * 0.35 }, T);
    AC.props = glMesh(o);
  }
  return AC.props;
}
function malhaFumaca() {
  if (!AC.fumaca) {
    const b = MB();
    mbIco(b, M4.S(1, 1, 1), "#b8b4ac", 0, 0.25, 0.05);
    AC.fumaca = glMesh(b);
  }
  return AC.fumaca;
}

/** Desenha o acampamento (renderer, no campo aberto): os objetos e o Caçador perto da tela; a fumaça bem de longe. */
export function acampamentoCampoGL() {
  const F = fogueiraNoCampo(),
    c = cantoCampo();
  if (!F || !c || dungeon.vila) return;
  const T = dungeon.tile,
    x = F.x - c.x,
    z = F.y - c.y,
    longe = Math.hypot(x - dungeon.px, z - dungeon.py);
  if (longe > ACAMP_CAMPO.fumaca * T) return;
  const h = alturaChao(F.x, F.y),
    t = performance.now() / 1000;
  // a coluna de fumaça: rolos que sobem, crescem até o meio e encolhem até sumir (o renderer não tem transparência);
  // um pouco acesos, como as chamas, para a fumaça clara aparecer de noite; sem contorno
  const f = malhaFumaca();
  for (let i = 0; i < 12; i++) {
    const k = (t * 0.09 + i / 12) % 1,
      r = 3 + Math.sin(k * Math.PI) * 15;
    glPush(
      f,
      M4.ch(
        M4.T(x + Math.sin(k * 5 + i) * 6 + k * 30, h + 24 + k * 230, z + Math.cos(k * 4 + i) * 5),
        M4.S(r, r * 0.8, r),
      ),
      [0.66, 0.64, 0.6, 0.8],
      false,
    );
    const it = GL3.list[GL3.list.length - 1];
    it.brilha = true;
    it.noOl = true;
  }
  if (longe > MUNDO.vista.cols * T) return; // longe da tela: só a fumaça
  glPush(malhaProps(), M4.T(x, h, z));
  chamasGLPush({ x, y: z });
  if (econ.hunterCamp || econ.introDone) {
    const n = AC.npc;
    n.x = x - T * 0.2;
    n.y = z - T * 1.55;
    n.yaw = Math.atan2(dungeon.py - n.y, dungeon.px - n.x); // o Caçador olha para quem chega
    npcGL(n);
  }
}

/** O marcador na borda da tela (#acamp-marca, dentro do #dungeon-view): com o acampamento a menos de
    ACAMP_CAMPO.marca casas e fora do quadro, aponta para ele e diz quantos passos faltam. */
function marcador(dist: number) {
  const d = dungeon,
    T = d.tile,
    F = fogueiraNoCampo(),
    c = cantoCampo(),
    cv = TELAS.dCanvas;
  let el = document.getElementById("acamp-marca"),
    mostra = false;
  if (F && c && cv && D3.on && dist < ACAMP_CAMPO.marca * T) {
    const r = cv.getBoundingClientRect(),
      kx = r.width / (D3.cw || 1),
      ky = r.height / (D3.ch || 1),
      sx = (D3.cw / 2 + (F.x - c.x - D3.cx) * D3.s) * kx,
      sy = (D3.ch / 2 + D3.vy + (F.y - c.y - D3.cz) * D3.SIN! * D3.s) * ky,
      m = 54,
      cima = 132, // abaixo do objetivo e do aviso no alto da tela
      baixo = 150, // acima da barra da heroína
      mx = r.width / 2,
      my = (cima + r.height - baixo) / 2;
    if (sx < m || sy < cima || sx > r.width - m || sy > r.height - baixo) {
      const dx = sx - mx,
        dy = sy - my,
        k = Math.min((mx - m) / Math.max(1e-6, Math.abs(dx)), (my - cima) / Math.max(1e-6, Math.abs(dy)));
      if (!el) {
        el = document.createElement("div");
        el.id = "acamp-marca";
        el.innerHTML = "<i>➤</i><b></b>";
        document.getElementById("dungeon-view")?.appendChild(el);
      }
      el.style.left = r.left + mx + dx * k + "px";
      el.style.top = r.top + my + dy * k + "px";
      el.querySelector("i")!.style.transform = "rotate(" + Math.atan2(dy, dx) + "rad)";
      const txt = "⛺ " + Math.max(1, Math.round((dist - ACAMP_CAMPO.entrada * T) / T)) + " passos";
      if (el.querySelector("b")!.textContent !== txt) el.querySelector("b")!.textContent = txt;
      mostra = true;
    }
  }
  if (el) el.classList.toggle("on", mostra);
}

/** Tique do campo aberto: o marcador, perto da clareira o aviso, e chegando à fogueira vindo de fora, entra no
    acampamento. */
export function acampamentoCampoTick() {
  const d = dungeon;
  if (!d.active || d.mode !== "campo" || !d.origem || !d.hero || d.vila) {
    marcador(Infinity);
    return;
  }
  const T = d.tile,
    dist = distFogueira();
  marcador(dist);
  if (d.sess !== AC.sess) {
    AC.sess = d.sess;
    AC.fora = dist > ACAMP_CAMPO.entrada * T; // abriu o campo já dentro: só entra depois de sair e voltar
    AC.viu = dist < (ACAMP_CAMPO.clareira + 2) * T;
  }
  if (!AC.viu && dist < (ACAMP_CAMPO.clareira + 6) * T) {
    AC.viu = true;
    // na caminhada da cena inicial o objetivo no alto já diz isso (e o aviso ficaria por cima dele)
    if (!document.getElementById("isc-obj")?.classList.contains("on"))
      setBanner("⛺ Acampamento do Caçador", "chegue até a fogueira para entrar", 3.5, "#ffd08a");
  }
  if (dist > (ACAMP_CAMPO.entrada + 1.5) * T) AC.fora = true;
  if (!AC.fora || dist > ACAMP_CAMPO.entrada * T || d.dead || d.modalOpen || d.invOpen || d.finish) return;
  AC.fora = false;
  acampamentoDireto(d.hero);
}
