/* ==== v7.7 — animais do campo animados (pacote craftpix: src/assets/models/<bicho>_anim.json, tools/gerar-bichos.ts) ====
   Lobo, javali, cervo macho/fêmea e coelho com malha, esqueleto e animações feitas na ferramenta (parada, andar,
   correr, salto do bote, pastar). Cada bicho na tela usa um "animado" (animado.ts) de uma reserva por espécie: o de
   um bicho que sumiu há mais de BICHOS.livre s volta para a reserva (os buffers da GPU não crescem sem fim). Andar ou
   correr sai da velocidade; o passo acompanha a distância andada (o pé não escorrega). O lobo tem a cor da pelagem
   multiplicada sobre a do modelo (cinza = WOLF_COATS[0]). Sem os dados (testes em Node) devolve null e o renderer
   usa as malhas antigas. */
import { novoAnimado, animar, trocarTom } from "./animado.ts";
import { duracaoClip, type DadosAnim } from "./esqueleto.ts";
import { gcol } from "./malhas.ts";
import { WOLF_COATS } from "./shaders.ts";
import type { GLMesh } from "../../core/tipos.ts";
import { GL3 } from "../../core/state.ts";
import { M4, type Vec3 } from "./geometria.ts";

// os marcadores precisam de `{}` logo depois do comentário (o plugin troca os dois pelo JSON); nos testes em Node ficam vazios
const DADOS: Record<string, DadosAnim> = {
  lobo: /* @inline-json src/assets/models/lobo_anim.json */ {} as DadosAnim,
  javali: /* @inline-json src/assets/models/javali_anim.json */ {} as DadosAnim,
  cervo_m: /* @inline-json src/assets/models/cervo_m_anim.json */ {} as DadosAnim,
  cervo_f: /* @inline-json src/assets/models/cervo_f_anim.json */ {} as DadosAnim,
  coelho: /* @inline-json src/assets/models/coelho_anim.json */ {} as DadosAnim,
  raposa: /* @inline-json src/assets/models/raposa_anim.json */ {} as DadosAnim, // v8.0: a caçada da raposa
  tamandua: /* @inline-json src/assets/models/tamandua_anim.json */ {} as DadosAnim, // v7.7: tools/gerar-tamandua.ts
};

/** Por espécie: quanto anda num ciclo do andar e do correr (mundo). Acima de `correr` × passoAndar por segundo, corre. */
const BICHOS = {
  passos: <Record<string, [number, number]>>{
    lobo: [30, 62],
    javali: [26, 54],
    cervo_m: [36, 80],
    cervo_f: [33, 74],
    coelho: [14, 26],
    raposa: [24, 50],
    tamandua: [55, 110],
  },
  correr: 1.5,
  livre: 1.5, // s sem ser desenhado para o animado voltar à reserva
  troca: 0.2,
};

type Animado = ReturnType<typeof novoAnimado>;
interface Uso {
  X: Animado;
  esp: string;
  dono: object | null;
  visto: number; // performance.now() do último quadro desenhado
  x: number;
  y: number;
  vel: number; // velocidade suavizada (mundo/s)
}
const RESERVA: Uso[] = [];
const DE = new WeakMap<object, Uso>();

/** Primeiro contato do raio com a pele animada que foi desenhada neste quadro. */
export function contatoPeleBicho(dono: object, origem: Vec3, direcao: Vec3): Vec3 | null {
  const X = DE.get(dono)?.X,
    p = X?.def?.p,
    desenho = X?.mesh && GL3.list.find((it) => it.mesh === X.mesh);
  if (!p || !desenho) return null;
  let perto = Infinity;
  for (let i = 0; i < p.length; i += 9) {
    const a = M4.ap(desenho.M, p[i], p[i + 1], p[i + 2]),
      b = M4.ap(desenho.M, p[i + 3], p[i + 4], p[i + 5]),
      c = M4.ap(desenho.M, p[i + 6], p[i + 7], p[i + 8]),
      e1 = b.map((v, k) => v - a[k]),
      e2 = c.map((v, k) => v - a[k]),
      h = [
        direcao[1] * e2[2] - direcao[2] * e2[1],
        direcao[2] * e2[0] - direcao[0] * e2[2],
        direcao[0] * e2[1] - direcao[1] * e2[0],
      ],
      det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
    if (Math.abs(det) < 1e-7) continue;
    const s = origem.map((v, k) => v - a[k]),
      u = (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]) / det;
    if (u < 0 || u > 1) continue;
    const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]],
      v = (direcao[0] * q[0] + direcao[1] * q[1] + direcao[2] * q[2]) / det;
    if (v < 0 || u + v > 1) continue;
    const t = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det;
    if (t >= 0) perto = Math.min(perto, t);
  }
  return Number.isFinite(perto)
    ? [origem[0] + direcao[0] * perto, origem[1] + direcao[1] * perto, origem[2] + direcao[2] * perto]
    : null;
}

function usoDe(dono: object, esp: string, x: number, y: number, agora: number): Uso {
  const u = DE.get(dono);
  if (u && u.dono === dono && u.esp === esp) return u;
  let livre = RESERVA.find((r) => r.esp === esp && agora - r.visto > BICHOS.livre * 1000);
  if (livre) {
    if (livre.dono) DE.delete(livre.dono);
  } else {
    const [pa, pc] = BICHOS.passos[esp] || [30, 60];
    livre = {
      X: novoAnimado(
        DADOS[esp],
        { passoAndar: pa, passoCorrer: pc, rolarDur: 0.6, coletarDur: 0.8, troca: BICHOS.troca },
        () => ({}),
      ),
      esp,
      dono: null,
      visto: agora,
      x,
      y,
      vel: 0,
    };
    RESERVA.push(livre);
  }
  livre.dono = dono;
  livre.x = x;
  livre.y = y;
  livre.vel = 0;
  livre.visto = agora;
  DE.set(dono, livre);
  return livre;
}

const TONS: Record<number, number[]> = {};
/** O tom de uma pelagem de lobo (índice em WOLF_COATS): a cor dela ÷ a do modelo (o cinza da primeira). */
export function tomPelagem(i: number) {
  if (!TONS[i]) {
    const base = gcol(WOLF_COATS[0]),
      c = gcol(WOLF_COATS[i % WOLF_COATS.length]);
    TONS[i] = [0, 1, 2].map((k) => c[k] / base[k]);
  }
  return TONS[i];
}

/**
 * A malha animada do bicho `dono` (o monstro, ou o fantasma do lobo) em (x, y) do mundo, no espaço do modelo
 * (frente +x, pés em y=0). `fixo`: um clip parado num instante ("salto"); `pastar`: o cervo comendo (em laço);
 * `tom`: a pelagem. null sem os dados ou sem WebGL.
 */
export function bichoAnimado(
  dono: object,
  esp: string,
  x: number,
  y: number,
  opc: { fixo?: string; pastar?: boolean; tom?: number[] | null } = {},
): GLMesh | null {
  const D = DADOS[esp];
  if (!D || !D.clips) return null;
  const agora = performance.now(),
    u = usoDe(dono, esp, x, y, agora),
    dt = Math.min(0.1, Math.max(0, (agora - u.visto) / 1000)) || 1 / 60;
  let andou = Math.hypot(x - u.x, y - u.y);
  if (andou > 60) andou = 0; // pulou de lugar
  u.vel += (andou / dt - u.vel) * Math.min(1, dt * 8);
  u.x = x;
  u.y = y;
  u.visto = agora;
  trocarTom(u.X, opc.tom ?? null);
  const movendo = u.vel > 4 && !opc.fixo && !opc.pastar,
    pa = u.X.aj.passoAndar;
  let fixo: { clip: string; t: number } | undefined;
  if (opc.fixo) fixo = { clip: opc.fixo, t: 0 };
  else if (opc.pastar && u.X.A) {
    const dur = duracaoClip(u.X.A, "pastar");
    fixo = { clip: "pastar", t: dur > 0 ? (agora / 1000) % dur : 0 };
  }
  const r = animar(u.X, {
    dt,
    andou,
    movendo: movendo ? 1 : 0,
    correndo: u.vel > pa * BICHOS.correr ? 1 : 0,
    fixo,
  });
  return r ? r.mesh : null;
}

/** v7.7 — um ponto marcado no modelo (unidades do jogo, espaço do modelo), ou null sem os dados (o tamanduá: "sela"). */
export function marcaBicho(esp: string, nome: string): number[] | null {
  const M = DADOS[esp] && DADOS[esp].marcas;
  return (M && M[nome]) || null;
}
