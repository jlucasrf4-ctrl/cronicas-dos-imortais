/* ==== v8.0 — a luz da hora do dia, no mapa e no campo ====
   luzDoDia diz quanto está escuro e quanto é poente/aurora (tabela NOITE_MAPA em data/mapa.ts); desenharCamadaMapa
   (map/quadro.ts) pinta o véu do mapa com isso, e luzCampo dá o fator de cor que o renderizador do campo multiplica na
   cena (glRender, tabela NOITE_CAMPO). */
import { world } from "../core/state.ts";
import { CONFIG } from "../core/config.ts";
import { NOITE_MAPA, NOITE_CAMPO, FOGO_LUZ } from "../data/mapa.ts";
import { ESTACOES } from "../data/editor.ts";
import { ED } from "../editor/estado.ts";

/** [escuro, poente] (0..1) na hora atual do mundo (v8.1: ou na hora que o Modo Editor fixou, ED.hora). */
export function luzDoDia() {
  const N = NOITE_MAPA,
    h = ED.on && ED.hora != null ? ED.hora : (world.tick % CONFIG.DAY_MIN) / 60,
    suave = (a: number, b: number) => {
      const t = Math.min(1, Math.max(0, (h - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
  let escuro: number, meio: number;
  if (h >= N.dia && h < N.escurece) return [0, 0];
  if (h >= N.escurece) {
    escuro = suave(N.escurece, N.noite);
    meio = Math.min(1, Math.max(0, (h - N.escurece) / (N.noite - N.escurece)));
  } else {
    escuro = 1 - suave(N.clareia, N.dia);
    meio = Math.min(1, Math.max(0, (h - N.clareia) / (N.dia - N.clareia)));
  }
  return [escuro, Math.sin(meio * Math.PI)];
}

/** A luz das fogueiras acesas do quadro (`fogos`: [x, z, força 0..1], quem desenha a chama registra): as posições
 *  (x, y, z, raio) das `FOGO_LUZ.max` mais fortes, com tremor, e a cor × a força da hora. Sem fogueira ou de dia, null. */
export function luzFogueira(fogos: number[][]) {
  const [escuro, poente] = luzDoDia(),
    F = FOGO_LUZ,
    forca = F.dia + (F.poente - F.dia) * poente * (1 - escuro) + (F.noite - F.dia) * escuro;
  if (!fogos.length || forca <= 0.01) return null;
  const t = performance.now() / 1000,
    pos: number[] = [];
  for (const [x, z, k] of [...fogos].sort((a, b) => b[2] - a[2]).slice(0, F.max)) {
    const tr = 1 + F.tremor * (Math.sin(t * 11 + x) * 0.6 + Math.sin(t * 23 + z) * 0.4);
    pos.push(x, F.altura, z, F.raio * (0.4 + 0.6 * k) * tr);
  }
  return { pos, cor: F.cor.map((c) => c * forca) };
}

/** O fator de cor (rgb) da cena do campo agora: 1 de dia, alaranjado no poente, azul-escuro à noite. */
export function luzCampo() {
  const [escuro, poente] = luzDoDia(),
    C = NOITE_CAMPO,
    p = poente * C.forcaPoente,
    // v8.1: a prévia de estação do Modo Editor muda um pouco a luz
    est = ED.on && ED.estacao ? ESTACOES[ED.estacao]?.luz : null;
  return [0, 1, 2].map((i) => {
    const comPoente = 1 + (C.poente[i] - 1) * p;
    return (comPoente + (C.noite[i] - comPoente) * escuro) * (est ? est[i] : 1);
  });
}
