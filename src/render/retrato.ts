/* ==== Fase 4 — retrato 3D girando no preparo (base/15) ==== */
import { M4, MALHA } from "./gl/geometria.ts";
import { glPush, glInit, glRender, glPlace, rodM } from "./gl/renderer.ts";
import { wpnMesh } from "./gl/armas.ts";
import { GL3, OPT, dungeon } from "../core/state.ts";
import { eqSig, heroEq } from "../items/equipamento.ts";
import { glFree, MB, mbCyl, mbIco, grnd, glMesh } from "./gl/malhas.ts";
import { glBuildHero } from "./gl/estilo.ts";
import { HEROINA } from "./gl/heroina.ts";
import { persp } from "../intro/cinematica.ts";
import { desenharRetratoVivo, desenharModeloTeste } from "./gl/vestidos.ts";
import { armaModelo, pontasArco } from "./gl/armas3d.ts";
import { preso, type SituacaoAnim } from "./gl/animado.ts";
import { ACOES_CRIACAO, PALCO_CRIACAO } from "../data/retrato.ts";
import type { GLMesh, Hero } from "../core/tipos.ts";

/* ---------- retrato 3D girando no preparo ---------- */
export const PORT = { raf: 0, yaw: 0.5, drag: null as { x: number; y0: number } | null, auto: true };
function heroPoseStatic(h: Hero, P: Record<string, GLMesh>, EQ: Record<string, number>, yaw: number, t: number) {
  // pose parada (respirando) para o retrato
  const SC = 1.3,
    br = Math.sin(t * 1.6) * 0.4,
    base = M4.ch(M4.RY(-yaw), M4.S(SC)),
    body = M4.ch(base, M4.T(0, br * 0.3, 0));
  // v7.7: heroína
  glPush(P.torsoH, body);
  glPush(P.pernaD, M4.ch(base, M4.T(0, 15, 2.8), M4.RZ(0.05)));
  glPush(P.pernaE, M4.ch(base, M4.T(0, 15, -2.8), M4.RZ(-0.08)));
  const shR = M4.ch(body, M4.T(0, HEROINA.ombroY, HEROINA.ombroZ)),
    shL = M4.ch(body, M4.T(0, HEROINA.ombroY, -HEROINA.ombroZ)),
    armR = M4.ch(shR, M4.RX(0.12), M4.RZ(0.28)),
    armL = M4.ch(shL, M4.RX(-0.12), M4.RZ(0.2));
  glPush(P.bracoD, armR);
  if (EQ.maoD) glPush(wpnMesh(h, P), M4.ch(armR, M4.T(...HEROINA.mao), M4.RZ(-1.1)));
  glPush(P.bracoE, armL);
  if (EQ.maoE) glPush(P.escudo, armL);
  if (EQ.costas) glPush(P.bowOnly, M4.ch(body, M4.T(-6.4, 24, 0), M4.RX(0.55), M4.S(0.85)));
}
/* v7.7: o preparo não usa mais o retrato (a silhueta de ui/preparo_tela.ts ficou no lugar); só a mochila do campo. */
/** Desenha a heroína girando no pedestal em out. 
oCampo: com o campo ativo (a mochila aberta), usa o canvas do
    campo entre dois quadros e devolve o tamanho dele (glPlace); o quadro seguinte redesenha o campo. */
export function glPortrait(h: Hero, out: HTMLCanvasElement, t: number, noCampo = false) {
  if (!GL3.tried) glInit();
  if (!GL3.ok || (dungeon.active && !noCampo) || GL3._home) return false;
  const cv = GL3.cv,
    W = out.width,
    H = out.height;
  if (cv.width !== W || cv.height !== H) {
    cv.width = W;
    cv.height = H;
  }
  const key = h.color + "|" + eqSig(h);
  if (GL3.portKey !== key) {
    if (GL3.port) for (const k in GL3.port) glFree(GL3.port[k]);
    GL3.port = glBuildHero(h.color, heroEq(h));
    GL3.portKey = key;
  }
  pedestal();
  if (PORT.auto && !PORT.drag) PORT.yaw += 0.006;
  GL3.list.length = 0;
  glPush(GL3.mesh.pedestal, M4.id(), null, false);
  heroPoseStatic(h, GL3.port!, heroEq(h), PORT.yaw, t);
  return fecharRetrato(out, W, H, noCampo);
}
function pedestal() {
  if (!GL3.mesh.pedestal) {
    MALHA._gs = 5;
    const b = MB();
    mbCyl(b, M4.ch(M4.T(0, -2.2, 0), M4.S(46, 2.2, 46)), "#6d5f4a", 12, 0.94, 0.08);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * 6.28;
      mbIco(
        b,
        M4.ch(M4.T(Math.cos(a) * 21, 0.3, Math.sin(a) * 21), M4.S(3 + grnd() * 2, 1.6, 3)),
        "#7f9a4a",
        0,
        0.3,
        0.1,
      );
    }
    GL3.mesh.pedestal = glMesh(b);
  }
}
/** Câmera, luz e cópia para out do retrato antigo (com a vinheta). */
function fecharRetrato(out: HTMLCanvasElement, W: number, H: number, noCampo: boolean) {
  const cv = GL3.cv,
    eye = [118, 40, 8],
    VP = M4.mul(persp(0.5, W / H, 1, 600), M4.look(eye, [0, 25, 0], [0, 1, 0]));
  const Ld = (() => {
      const v = [-0.35, -0.75, 0.55],
        l = Math.hypot(...v);
      return v.map((x) => x / l);
    })(),
    LV = M4.mul(
      M4.ortho(-70, 70, -70, 70, 1, 600),
      M4.look([-Ld[0] * 200, -Ld[1] * 200, -Ld[2] * 200], [0, 20, 0], [0, 1, 0]),
    );
  glRender(VP, LV, Ld, [0.16, 0.12, 0.07], null);
  const c = out.getContext("2d");
  c!.drawImage(cv, 0, 0);
  const g = c!.createRadialGradient(W / 2, H * 0.45, W * 0.25, W / 2, H * 0.5, W * 0.85);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,.45)");
  c!.fillStyle = g;
  c!.fillRect(0, 0, W, H);
  if (noCampo) glPlace();
  return true;
}
/* v7.7: a mochila do campo também trocou o retrato pela silhueta (ui/inventario.ts: dollHtml) */

/** v8.0 — o retrato da criação: o personagem sorteado (corpo + cabeça, Hero.visual) animado, parado e sem armas, no
 *  pedestal, girando devagar (ou arrastado: PORT.drag). Corpo inteiro num quadro em pé. Sem WebGL/dados: false. */
export function glRetratoVivo(
  h: Pick<Hero, "visual"> & Partial<Pick<Hero, "equip">>,
  out: HTMLCanvasElement,
  opc: {
    noCampo?: boolean;
    yaw?: number;
    modelo?: string;
    clip?: string;
    tempo?: number;
    zoom?: number;
    situacao?: Partial<SituacaoAnim>;
    alvoY?: number;
    restaurarCampo?: boolean;
  } = {},
) {
  if (!GL3.tried) glInit();
  if (!GL3.ok || (dungeon.active && !opc.noCampo) || GL3._home) return false;
  const cv = GL3.cv,
    W = out.width,
    H = out.height;
  if (cv.width !== W || cv.height !== H) {
    cv.width = W;
    cv.height = H;
  }
  pedestal();
  if (opc.yaw == null && PORT.auto && !PORT.drag) PORT.yaw += 0.004;
  GL3.list.length = 0;
  glPush(GL3.mesh.pedestal, M4.id(), null, false);
  const desenho = opc.modelo
    ? desenharModeloTeste(opc.modelo, opc.yaw ?? PORT.yaw, opc.clip ?? "parada", opc.tempo ?? 0, h.visual)
    : desenharRetratoVivo(h.visual, opc.yaw ?? PORT.yaw, opc.situacao ?? {}, h.equip);
  if (!desenho) return false;
  const zoom = opc.zoom ?? 1,
    centroY = opc.alvoY ?? (opc.modelo ? 31 + 18 * Math.max(0, Math.min(1, (zoom - 1) / 1.5)) : 31),
    alvo = [0, centroY, 0],
    eye = [150 / zoom, centroY + 13, 0],
    VP = M4.mul(persp(0.5, W / H, 1, 600), M4.look(eye, alvo, [0, 1, 0]));
  const Ld = (() => {
      const v = [-0.45, -0.7, 0.55],
        l = Math.hypot(...v);
      return v.map((x) => x / l);
    })(),
    LV = M4.mul(
      M4.ortho(-70, 70, -70, 70, 1, 600),
      M4.look([-Ld[0] * 200, -Ld[1] * 200, -Ld[2] * 200], [0, 25, 0], [0, 1, 0]),
    );
  // sem o contorno de tela: nesta escala ele vira uma auréola escura grossa em volta do corpo
  const ol = OPT.outline;
  OPT.outline = false;
  try {
    glRender(VP, LV, Ld, [0.2, 0.15, 0.1], null);
  } finally {
    OPT.outline = ol;
  }
  const c = out.getContext("2d")!;
  c.clearRect(0, 0, W, H);
  c.drawImage(cv, 0, 0);
  if (opc.noCampo && opc.restaurarCampo !== false) glPlace(); // o canvas volta ao tamanho do campo; o quadro do campo vem logo depois
  return true;
}

/** Preview equipado da tela de preparação; mantém a silhueta de fundo se WebGL estiver indisponível. */
export function glRetratoEquipado(h: Pick<Hero, "visual" | "equip">, out: HTMLCanvasElement) {
  return glRetratoVivo(h, out, { noCampo: true, yaw: PORT.yaw });
}

/* ---------- v8.1 — o palco da criação: close no busto; clicando, o corpo inteiro numa demonstração em laço ---------- */
/** inteira: o corpo inteiro (a demonstração); acao/t:
 *  qual ação da demonstração (ACOES_CRIACAO) e há quanto tempo; solta: a flecha no instante do tiro (mundo: a ponta
 *  de trás e a direção); ult: o quadro anterior (performance.now). */
export const PALCO = {
  inteira: false,
  acao: 0,
  t: 0,
  solta: null as { p: number[]; u: number[] } | null,
  ult: 0,
  cam: null as { alvo: number[]; olho: number[] } | null, // v8.1: a câmera indo atrás do alvo (o jogo de câmera)
};
/** Onde a câmera parou de seguir a flecha (mundo; null = não está seguindo). */
const FOCO_FLECHA = { p: null as number[] | null };
/** Clicou no palco: alterna close × corpo inteiro (a demonstração recomeça da espada). */
export function palcoAlternar() {
  palcoIr(!PALCO.inteira, 0);
}
/** Mostra o corpo inteiro (ou o close) e começa a ação `i`. */
export function palcoIr(inteira: boolean, i: number) {
  PALCO.inteira = inteira;
  PALCO.acao = i;
  PALCO.t = 0;
  PALCO.solta = null;
  PORT.yaw = inteira ? PALCO_CRIACAO.inteira.yaw : PALCO_CRIACAO.close.yaw;
  PORT.auto = false;
}
/** Quanto dura a ação (s), sem o respiro. */
function duracaoAcao(id: string) {
  const P = PALCO_CRIACAO;
  if (id === "espada") return 3 * (P.espada.golpe + P.espada.entre);
  if (id === "machado")
    return P.machado.vezes * (P.machado.carga + P.machado.segura + P.machado.golpe + P.machado.entre);
  return P.arco.puxa + P.arco.mira + P.arco.voo;
}
/** O que a personagem faz no instante t da ação: a situação da animação, a arma e onde ela está, o tempo desde o
 *  golpe do machado na árvore (null = sem árvore) e o tempo de voo da flecha. */
function quadroAcao(id: string, t: number) {
  const P = PALCO_CRIACAO,
    r = {
      s: {} as Partial<SituacaoAnim>,
      arma: null as string | null,
      onde: "mao" as "mao" | "puxa" | "voo",
      arvore: null as number | null,
      voo: 0,
    };
  if (t >= duracaoAcao(id)) return r; // o respiro: parada, de mãos vazias
  if (id === "espada") {
    const E = P.espada,
      i = Math.floor(t / (E.golpe + E.entre)),
      l = t - i * (E.golpe + E.entre);
    r.arma = E.arma;
    r.s.modo = "combate";
    if (l < E.golpe) r.s.combo = { passo: i, t: (l / E.golpe) * 0.38 };
  } else if (id === "machado") {
    const M = P.machado,
      ciclo = M.carga + M.segura + M.golpe + M.entre,
      i = Math.min(M.vezes - 1, Math.floor(t / ciclo)),
      l = t - i * ciclo;
    r.arma = M.arma;
    if (l < M.carga) r.s.machadoCarga = l / M.carga;
    else if (l < M.carga + M.segura) r.s.machadoCarga = 1;
    else if (l < M.carga + M.segura + M.golpe) r.s.machadoGolpe = (l - M.carga - M.segura) / M.golpe;
    const bate = M.carga + M.segura + M.golpe * M.acerto,
      desde = l >= bate ? l - bate : i > 0 ? l + ciclo - bate : -1;
    r.arvore = desde >= 0 ? desde : 99;
  } else {
    const A = P.arco;
    r.arma = A.arma;
    r.s.modo = "arco";
    if (t < A.puxa + A.mira) {
      r.s.carga = Math.min(1, t / A.puxa);
      r.s.mirando = t >= A.puxa;
      r.onde = "puxa";
    } else {
      r.onde = "voo";
      r.voo = t - A.puxa - A.mira;
      r.s.soltando = r.voo < 0.1;
    }
  }
  return r;
}
/** v8.1 — a corda e a flecha do arco do palco (um cilindro de raio 0,5, y de 0 a 1, esticado com rodM). */
function pecasArco() {
  if (!GL3.mesh.fioPalco) {
    MALHA._gs = 17;
    for (const [k, cor] of [
      ["fioPalco", "#e8dcc0"],
      ["hasteFlecha", "#8a5a30"],
      ["pontaFlecha", "#9aa3ae"],
      ["penaFlecha", "#d8d2c6"],
    ]) {
      const b = MB();
      if (k === "pontaFlecha") mbCyl(b, M4.id(), cor, 5, 0);
      else mbCyl(b, M4.id(), cor, k === "penaFlecha" ? 3 : 5, 1);
      GL3.mesh[k] = glMesh(b);
    }
  }
}
/** A flecha de `p` (trás) ao longo da direção `u` (mundo, unitária), com comprimento L. */
function flechaPush(p: number[], u: number[], L: number) {
  const em = (k: number) => p.map((v, i) => v + u[i] * k);
  glPush(GL3.mesh.hasteFlecha, rodM(p, em(L), 0.7));
  glPush(GL3.mesh.pontaFlecha, rodM(em(L), em(L + 4), 2));
  glPush(GL3.mesh.penaFlecha, rodM(em(0.5), em(5), 2.4, 0.3));
}
/** A arvorezinha do machado (tronco e duas copas), feita uma vez. */
function arvorePalco() {
  if (!GL3.mesh.arvorePalco) {
    MALHA._gs = 11;
    const b = MB();
    mbCyl(b, M4.S(3.2, 26, 3.2), "#6b4a2b", 7, 0.7, 0.08);
    mbIco(b, M4.ch(M4.T(0, 27, 0), M4.S(17, 15, 17)), "#5f8a3a", 0, 0.35, 0.1);
    mbIco(b, M4.ch(M4.T(1.5, 36, -1), M4.S(11, 10, 11)), "#6f9a44", 0, 0.35, 0.1);
    GL3.mesh.arvorePalco = glMesh(b);
  }
  if (!GL3.mesh.folhaPalco) {
    const b = MB();
    mbIco(b, M4.S(1.6, 0.5, 1.2), "#7fa64a", 0, 0.2, 0.1);
    GL3.mesh.folhaPalco = glMesh(b);
  }
}
/** O retrato da criação: o personagem com a aparência dele, em close ou inteiro com a demonstração. false sem WebGL. */
export function glRetratoCriacao(h: Pick<Hero, "visual" | "equip">, out: HTMLCanvasElement) {
  if (!GL3.tried) glInit();
  if (!GL3.ok || dungeon.active || GL3._home) return false;
  const cv = GL3.cv,
    W = out.width,
    H = out.height;
  if (cv.width !== W || cv.height !== H) {
    cv.width = W;
    cv.height = H;
  }
  const P = PALCO_CRIACAO,
    agora = performance.now(),
    dt = PALCO.ult ? Math.min(0.1, (agora - PALCO.ult) / 1000) : 0;
  PALCO.ult = agora;
  // a demonstração só anda com o corpo inteiro; no fim de cada ação (e do respiro), a próxima
  let q = quadroAcao("", 99);
  if (PALCO.inteira) {
    const id = ACOES_CRIACAO[PALCO.acao].id;
    PALCO.t += dt;
    if (PALCO.t >= duracaoAcao(id) + P.respiro) {
      PALCO.acao = (PALCO.acao + 1) % ACOES_CRIACAO.length;
      PALCO.t = 0;
      PALCO.solta = null;
    }
    q = quadroAcao(ACOES_CRIACAO[PALCO.acao].id, PALCO.t);
  }
  pedestal();
  GL3.list.length = 0;
  glPush(GL3.mesh.pedestal, M4.id(), null, false);
  const r = desenharRetratoVivo(h.visual, PORT.yaw, q.s, h.equip);
  if (!r) return false;
  // a arma na mão; no arco, a corda (puxada até a mão direita ou reta), a flecha encaixada e, solta, voando
  const malha = q.arma ? armaModelo(q.arma) : null,
    CL = P.camArco.voo;
  let flechaNoAr: number[] | null = null; // onde a flecha está (mundo), para a câmera seguir
  if (malha && ACOES_CRIACAO[PALCO.acao].id === "arco" && PALCO.inteira) {
    pecasArco();
    const bowM = M4.mul(r.base, preso(r.X, r.mat, "arco")),
      [pc, pb] = pontasArco(q.arma!) ?? [
        [0, 12],
        [0, -12],
      ],
      cima = M4.ap(bowM, pc[0], pc[1], 0),
      baixo = M4.ap(bowM, pb[0], pb[1], 0);
    glPush(malha, bowM);
    if (q.onde === "puxa") {
      const pm = M4.mul(r.base, preso(r.X, r.mat, "palmaD")),
        palma = [pm[12], pm[13], pm[14]],
        pega = [bowM[12], bowM[13], bowM[14]],
        d = pega.map((v, i) => v - palma[i]),
        n = Math.hypot(d[0], d[1], d[2]) || 1,
        u = d.map((v) => v / n);
      glPush(GL3.mesh.fioPalco, rodM(cima, palma, 0.45));
      glPush(GL3.mesh.fioPalco, rodM(baixo, palma, 0.45));
      flechaPush(palma, u, P.arco.comp);
      PALCO.solta = { p: palma, u };
    } else {
      glPush(GL3.mesh.fioPalco, rodM(cima, baixo, 0.45));
      if (q.onde === "voo" && PALCO.solta) {
        const A = P.arco,
          S = PALCO.solta,
          // câmera lenta logo depois de soltar: o voo anda a `lenta` nos primeiros `tLenta` s
          k = q.voo < CL.tLenta ? q.voo * CL.lenta : CL.tLenta * CL.lenta + (q.voo - CL.tLenta),
          d = A.vel * k,
          p = [S.p[0] + S.u[0] * d, S.p[1] + S.u[1] * d - A.queda * k * k, S.p[2] + S.u[2] * d],
          v = [S.u[0] * A.vel, S.u[1] * A.vel - 2 * A.queda * k, S.u[2] * A.vel],
          nv = Math.hypot(v[0], v[1], v[2]) || 1;
        flechaPush(
          p,
          v.map((x) => x / nv),
          A.comp,
        );
        flechaNoAr = p;
      }
    }
  } else if (malha) glPush(malha, M4.mul(r.base, preso(r.X, r.mat, "arma")));
  // a arvorezinha do machado: balança quando o machado bate e solta folhas
  if (q.arvore != null) {
    arvorePalco();
    const A = P.arvore,
      g = q.arvore,
      bal = g < 1.2 ? Math.sin(g * 18) * Math.exp(-g * 4) * A.balanco : 0,
      Tm = M4.ch(r.base, M4.T(A.x, 0, A.z), M4.S(A.tam));
    glPush(GL3.mesh.arvorePalco, M4.ch(Tm, M4.RX(bal), M4.RZ(-bal * 0.6)));
    if (g < 1.2)
      for (let i = 0; i < A.folhas; i++) {
        const a = (i / A.folhas) * 6.28 + 0.7,
          y = 30 - g * 22 - (i % 3) * 2;
        if (y > 0)
          glPush(
            GL3.mesh.folhaPalco,
            M4.ch(
              Tm,
              M4.T(Math.cos(a) * (6 + g * 7), y, Math.sin(a) * (6 + g * 7)),
              M4.RY(a + g * 5),
              M4.RX(g * 4 + i),
            ),
          );
      }
  }
  // a câmera: o close (rosto e busto) ou o corpo inteiro; v8.1 — no arco, o jogo de câmera (camArco): chega perto
  // puxando e mirando, segue a flecha solta e para, deixando-a sumir no fundo. A câmera vai atrás do alvo sem saltos.
  const V = PALCO.inteira ? P.inteira : P.close,
    CM = P.camArco;
  let alvo = V.alvo,
    olho = V.olho;
  if (PALCO.inteira && q.onde === "puxa") {
    alvo = [0, CM.mira.alvoY, 0];
    olho = [CM.mira.dist, CM.mira.alvoY + 3, 0];
  } else if (PALCO.inteira && q.onde === "voo" && flechaNoAr) {
    if (q.voo <= CL.para || !FOCO_FLECHA.p) FOCO_FLECHA.p = flechaNoAr;
    const f = FOCO_FLECHA.p,
      peito = [0, CM.mira.alvoY, 0];
    alvo = peito.map((v, i) => v + (f[i] - v) * CL.seguir);
    olho = [alvo[0] + CL.dist, alvo[1] + 6, alvo[2]];
  } else FOCO_FLECHA.p = null;
  if (!PALCO.cam) PALCO.cam = { alvo: [...alvo], olho: [...olho] };
  const kc = Math.min(1, dt * P.transicao * (q.onde === "voo" ? 1.8 : 1)),
    C = PALCO.cam;
  for (let i = 0; i < 3; i++) {
    C.alvo[i] += (alvo[i] - C.alvo[i]) * kc;
    C.olho[i] += (olho[i] - C.olho[i]) * kc;
  }
  const VP = M4.mul(persp(0.5, W / H, 1, 900), M4.look(C.olho, C.alvo, [0, 1, 0]));
  const Ld = (() => {
      const v = [-0.45, -0.7, 0.55],
        l = Math.hypot(...v);
      return v.map((x) => x / l);
    })(),
    LV = M4.mul(
      M4.ortho(-70, 70, -70, 70, 1, 600),
      M4.look([-Ld[0] * 200, -Ld[1] * 200, -Ld[2] * 200], [0, 25, 0], [0, 1, 0]),
    );
  const ol = OPT.outline;
  OPT.outline = false;
  try {
    glRender(VP, LV, Ld, [0.2, 0.15, 0.1], null);
  } finally {
    OPT.outline = ol;
  }
  const c = out.getContext("2d")!;
  c.clearRect(0, 0, W, H);
  c.drawImage(cv, 0, 0);
  return true;
}

/* ---------- v8.0 — o personagem em 3D na mochila do campo, no lugar da silhueta ---------- */
/** Quadros por segundo do retrato da mochila (cada um troca o tamanho do canvas do campo duas vezes: barato o
 *  bastante a 10, pesado a 60) e o giro (de frente, um pouco de lado). */
const MOCHILA_VIVA = { fps: 10, yaw: -0.3, t: 0 };
/** Chamado no começo de glFrame, antes do campo: com a mochila aberta e o lugar do retrato na tela, redesenha. */
export function mochilaVivaQuadro() {
  const cv = document.getElementById("inv-vivo") as HTMLCanvasElement | null;
  if (!dungeon.active || !dungeon.invOpen || !dungeon.hero || !cv || !cv.isConnected) return;
  // mochila ao lado (zoom máximo): a personagem já está na cena; a silhueta volta
  if (document.getElementById("inv-modal")?.classList.contains("lateral")) {
    cv.parentElement?.classList.remove("vivo");
    return;
  }
  const agora = performance.now();
  if (agora - MOCHILA_VIVA.t < 1000 / MOCHILA_VIVA.fps) return;
  MOCHILA_VIVA.t = agora;
  const ok = glRetratoVivo(dungeon.hero, cv, { noCampo: true, yaw: MOCHILA_VIVA.yaw });
  cv.parentElement?.classList.toggle("vivo", ok);
}
/* ---------- v8.1 — o retrato da criação dentro do painel 👤 Aparências do Modo Editor (editor/aparencias_qc.ts) ---------- */
/** cv: o canvas do painel (null = fechado); visual: a aparência mostrada; yaw: o giro (começa como na criação, um
 *  pouco de lado, de frente); auto: gira sozinho devagar (arrastar para); fps: o painel não precisa de 60. */
export const RETRATO_PAINEL = {
  cv: null as HTMLCanvasElement | null,
  visual: undefined as Hero["visual"],
  yaw: -0.35,
  auto: true,
  fps: 20,
  t: 0,
  modelo: "",
  clip: "parada",
  tempo: 0,
  reproduzir: true,
  zoom: 1,
};
/** Chamado no começo de glFrame, como o da mochila: com o painel aberto, redesenha a personagem dele. */
export function retratoPainelQuadro() {
  const P = RETRATO_PAINEL,
    cv = P.cv;
  if (!dungeon.active || !cv || !cv.isConnected || !cv.offsetParent) return;
  const agora = performance.now();
  if (agora - P.t < 1000 / P.fps) return;
  const dt = P.t ? Math.min(0.1, (agora - P.t) / 1000) : 0;
  P.t = agora;
  if (P.reproduzir) P.tempo += dt;
  if (P.auto) P.yaw += 0.012;
  glRetratoVivo({ visual: P.visual }, cv, {
    noCampo: true,
    yaw: P.yaw,
    modelo: P.modelo || undefined,
    clip: P.clip,
    tempo: P.tempo,
    zoom: P.zoom,
  });
}

/** O canvas do retrato da mochila (um só, que volta para dentro do quadro a cada renderInv). */
let cvMochila: HTMLCanvasElement | null = null;
export function canvasMochilaViva() {
  if (!cvMochila) {
    cvMochila = document.createElement("canvas");
    cvMochila.id = "inv-vivo";
    cvMochila.width = 340;
    cvMochila.height = 600;
  }
  MOCHILA_VIVA.t = 0; // redesenha já no próximo quadro
  return cvMochila;
}
