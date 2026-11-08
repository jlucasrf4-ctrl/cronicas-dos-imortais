/* ==== v8.1 (2026-11-08) — o cansaço dos bichos na corrida (data/combate.ts CANSACO) ====
   Mantenedor: "quando eles levantem e deem a corridona eles se cansem com isso, mas é possível você desistir pra se
   poupar e fazer outra coisa"; cansado, "quero que o inimigo escolha a melhor forma" entre desacelerar (o predador pode
   virar e lutar), parar e descansar, ou se esconder. A heroína já gasta fôlego correndo (field/chao.ts): desistir da
   perseguição a poupa, e o bicho recupera enquanto isso. */
import { dungeon } from "../core/state.ts";
import { CANSACO, DANO } from "../data/combate.ts";
import { folCap, folPct } from "./dano.ts";
import { folOn } from "./tipos.ts";
import { spawnDungeonToast } from "./masmorra.ts";
import type { Monster, Ponto } from "../core/tipos.ts";

/** Um quadro do gasto da corrida, pela distância que o bicho andou (`vel`, px/s). Chamado depois da IA de cada um
    (field/acertos.ts updateDungeonMonster). Humanos têm as regras deles (field/bandidos.ts); a fuga do susto
    (FOLEGO.desespero) já gasta o próprio fôlego. */
export function folCorrida(m: Monster, vel: number, dt: number) {
  if (!(dt > 0) || m.humano || m.ko! > 0 || m.bound || m.desespero! > 0 || m.fugaFolego! > 0) return;
  if (!folOn(m)) return;
  const C = CANSACO,
    T = dungeon.tile;
  if (vel > C.limiar * T) {
    const piso = m.folMax! * C.piso;
    if (m.fol! > piso) m.fol = Math.max(piso, m.fol! - C.gasto * m.folMax! * dt);
    m.folT = 0; // correndo não recupera
  } else if (vel > T * 0.1 && m.folT! > DANO.FOLEGO.espera && m.fol! < folCap(m)) {
    // andando recupera mais devagar: tira parte do que folTick acabou de devolver
    m.fol = Math.max(0, m.fol! - DANO.FOLEGO.regen * (1 - C.andaRegen) * dt);
  }
}

/** A moita mais perto do bicho, a até CANSACO.moita casas, que não fica do lado de quem ele foge. */
function moitaPerto(m: Monster, de: Ponto) {
  const T = dungeon.tile;
  let melhor = null,
    bd = T * CANSACO.moita;
  for (const b of dungeon.bushes || []) {
    const dm = Math.hypot(b.x - m.x, b.y - m.y);
    if (dm < bd && dm < Math.hypot(b.x - de.x, b.y - de.y)) {
      bd = dm;
      melhor = b;
    }
  }
  return melhor;
}

/** Cansado (fôlego abaixo de CANSACO.abaixo), escolhe a saída pela situação; `de` = de quem foge, `dp` = a distância.
    Predador perto → "luta" (quem chama o faz brigar); longe → descansa; moita boa → esconde; senão segue devagar. */
function escolher(m: Monster, de: Ponto, dp: number, predador: boolean) {
  const C = CANSACO,
    T = dungeon.tile;
  if (predador && dp < C.lutaPerto * T) return "luta" as const;
  if (dp > C.longe * T) return "descansa" as const;
  const b = moitaPerto(m, de);
  if (b) {
    m.cansado = { modo: "esconde", t: C.rever, moita: { x: b.x, y: b.y, r: b.r } };
    return "esconde" as const;
  }
  return "devagar" as const;
}

const AVISO: Record<string, string> = { descansa: "😮‍💨 descansa", esconde: "🌿 se esconde", devagar: "😮‍💨 cansado" };

/** Um quadro do bicho cansado. Devolve:
    - "luta": o predador vira e briga (quem chama decide como);
    - um ponto: correr até ali (a moita);
    - "parado": ficou parado recuperando (quem chama não move);
    - null: não está cansado, ou segue a fuga normal (devagar pelas faixas de fôlego). */
export function cansadoAI(m: Monster, de: Ponto, dt: number, predador = false): "luta" | "parado" | Ponto | null {
  if (!folOn(m) || m.desespero! > 0 || m.fugaFolego! > 0 || m.ko! > 0) {
    m.cansado = undefined;
    return null;
  }
  const C = CANSACO,
    T = dungeon.tile,
    p = folPct(m),
    dp = Math.hypot(de.x - m.x, de.y - m.y);
  if (!m.cansado) {
    if (p >= C.abaixo) return null;
    const e = escolher(m, de, dp, predador);
    if (e === "luta") return "luta";
    if (e !== "esconde") m.cansado = { modo: e, t: C.rever };
    spawnDungeonToast(AVISO[e], m.x, m.y - 30, "#c9d8e8", 11);
  } else if (p >= C.volta) {
    m.cansado = undefined;
    return null;
  }
  const c = m.cansado!;
  c.t -= dt;
  // a situação mudou: escolhe de novo (sem repetir o aviso)
  if (c.t <= 0 || (c.modo === "descansa" && dp < C.longe * T * 0.6)) {
    const e = escolher(m, de, dp, predador);
    if (e === "luta") {
      m.cansado = undefined;
      return "luta";
    }
    if (e !== "esconde") m.cansado = { modo: e, t: C.rever };
  }
  const k = m.cansado!;
  const descansar = () => {
    m.fol = Math.min(folCap(m), m.fol! + DANO.FOLEGO.regen * C.descansaRegen * dt);
    m.folT = DANO.FOLEGO.espera + 0.01; // conta como parado há tempo: folTick também devolve
    return "parado" as const;
  };
  if (k.modo === "descansa") return descansar();
  if (k.modo === "esconde" && k.moita) {
    const b = k.moita,
      dentro = Math.hypot(b.x - m.x, b.y - m.y) < b.r * 0.6;
    if (dentro) {
      if (dp < C.perto * T) {
        m.cansado = { modo: "devagar", t: C.rever }; // achado: sai correndo do que der
        return null;
      }
      k.t = Math.max(k.t, 0.5); // escondido não troca de ideia enquanto ninguém chega perto
      return descansar();
    }
    return { x: b.x, y: b.y };
  }
  return null;
}
