/* Recursos fisicos do campo aberto: arvores e pedras do cenario 3D. */
import { dungeon, world } from "../core/state.ts";
import { MUNDO } from "../map/mundo.ts";
import type { RecursoCampo } from "../core/tipos.ts";
import { gainSkill } from "../hero/nivel.ts";
import { GOLPES_RECURSO, PEDRA_QUEBRA } from "../data/combate.ts";
import { ORE_TABLE } from "../data/equipamento.ts";
import { ITEM_DEFS } from "../data/itens.ts";
import { D3, d3Bill } from "./projecao.ts";

type QualidadeCorte = "laranja" | "amarelo" | "verde" | "forte";
const GALHO_DURA = 3 * 24 * 60; // acompanha o tempo de renovacao da arvore
const blocos = new Map<string, RecursoCampo[]>();

export function limparRegistroRecursosCampo() {
  blocos.clear();
  dungeon.recursosCampo = [];
  dungeon.recursosCampoSujo = [];
}

export function registrarRecursosCampo(bloco: string, recursos: RecursoCampo[]) {
  if (blocos.get(bloco) === recursos) return;
  blocos.set(bloco, recursos);
  dungeon.recursosCampo = [...blocos.values()].flat().filter((n) => {
    const etapa = etapaRecursoCampo(n.id);
    return etapa === "arvore" || etapa === "tronco" || etapa === "lascado";
  });
}

export function removerRecursosCampo(bloco: string) {
  blocos.delete(bloco);
  dungeon.recursosCampo = [...blocos.values()].flat().filter((n) => {
    const etapa = etapaRecursoCampo(n.id);
    return etapa === "arvore" || etapa === "tronco" || etapa === "lascado";
  });
}

export function recursoCampoQuebrado(id: string) {
  return etapaRecursoCampo(id) !== "arvore";
}

function marcarBlocoSujo(id: string) {
  const recurso = (dungeon.recursosCampo || []).find((n) => n.id === id),
    estado = world.recursosCampo?.[id],
    partes = id.match(/^arvore:(-?\d+):(-?\d+)$/),
    larguraBloco = MUNDO.bloco * (dungeon.tile || 1),
    bloco =
      recurso?.bloco ||
      estado?.bloco ||
      (partes
        ? Math.floor(Number(partes[1]) / 100 / larguraBloco) + "," + Math.floor(Number(partes[2]) / 100 / larguraBloco)
        : null);
  if (bloco) dungeon.recursosCampoSujo = [...new Set([...(dungeon.recursosCampoSujo || []), bloco])];
}

function crescimentoAtual(estado: NonNullable<typeof world.recursosCampo>[string]) {
  if (estado.sementeAte == null || world.tick >= estado.sementeAte) return "arvore" as const;
  const falta = estado.sementeAte - world.tick;
  if (falta <= 24 * 60) return "muda" as const;
  if (falta <= 2 * 24 * 60) return "broto" as const;
  return "toco" as const;
}

export function atualizarCrescimentoArvores() {
  if (dungeon.loot?.some((l) => l.expiraEm != null && world.tick >= l.expiraEm))
    dungeon.loot = dungeon.loot.filter((l) => l.expiraEm == null || world.tick < l.expiraEm);
  for (const [id, estado] of Object.entries(world.recursosCampo || {})) {
    if (estado.etapa !== "toco" || estado.sementeAte == null) continue;
    const novo = crescimentoAtual(estado);
    if (novo === estado.crescimento) continue;
    marcarBlocoSujo(id);
    if (novo === "arvore") delete world.recursosCampo![id];
    else estado.crescimento = novo;
  }
}

export function etapaRecursoCampo(id: string) {
  const estado = world.recursosCampo?.[id];
  if (estado?.etapa === "toco" && estado.sementeAte != null) {
    const crescimento = crescimentoAtual(estado);
    if (crescimento === "arvore") {
      marcarBlocoSujo(id);
      delete world.recursosCampo![id];
      return "arvore";
    }
    estado.crescimento = crescimento;
    return crescimento;
  }
  return estado?.etapa || (estado?.quebrado ? "tronco" : "arvore");
}

function recursosProximosNoArco(angulo: number, etapas: string[], meiaAbertura = 0.92, tipo = "arvore") {
  const d = dungeon,
    h = d.hero;
  if (!h || d.mode !== "campo" || !d.origem || d.vila || d.camp || d.training) return null;
  const origemX = d.origem.x / MUNDO.escala,
    origemZ = d.origem.y / MUNDO.escala,
    alcance = d.tile * 1.3;
  let alvo: RecursoCampo | null = null,
    distAlvo = Infinity;
  for (const n of d.recursosCampo || []) {
    if (n.tipo !== tipo || !etapas.includes(etapaRecursoCampo(n.id))) continue;
    const dx = n.x - origemX - d.px,
      dz = n.z - origemZ - d.py,
      dist = Math.hypot(dx, dz),
      diff = Math.atan2(Math.sin(Math.atan2(dz, dx) - angulo), Math.cos(Math.atan2(dz, dx) - angulo));
    if (dist - n.raio > alcance || Math.abs(diff) > meiaAbertura || dist >= distAlvo) continue;
    alvo = n;
    distAlvo = dist;
  }
  return alvo;
}

export function arvoreCampoNaMira(angulo: number) {
  return recursosProximosNoArco(angulo, ["arvore"]);
}

export function troncoCampoNaMira(angulo: number) {
  return recursosProximosNoArco(angulo, ["tronco", "lascado"], 1.2);
}

/** v8.1 — a pedra inteira na mira da picareta (a etapa de uma pedra inteira é "arvore": etapaRecursoCampo). */
export function pedraCampoNaMira(angulo: number) {
  return recursosProximosNoArco(angulo, ["arvore"], 0.92, "pedra");
}
/** v8.1 — há uma pedra inteira ao alcance (o painel de ações no canto, ui/acoes.ts). */
export function pedraCampoPerto() {
  const d = dungeon;
  if (!d.hero || d.mode !== "campo" || !d.origem || d.vila || d.camp || d.training) return false;
  const ox = d.origem.x / MUNDO.escala,
    oz = d.origem.y / MUNDO.escala;
  return (d.recursosCampo || []).some(
    (n) =>
      n.tipo === "pedra" &&
      !recursoCampoQuebrado(n.id) &&
      Math.hypot(n.x - ox - d.px, n.z - oz - d.py) - n.raio < d.tile * 1.5,
  );
}

/** Revalida o tronco travado pelo início do golpe só pela distância, sem exigir que a mira fique imóvel. */
export function troncoCampoPorId(id: string) {
  const d = dungeon;
  if (!d.hero || d.mode !== "campo" || !d.origem || d.vila || d.camp || d.training) return null;
  const recurso = (d.recursosCampo || []).find((n) => n.id === id && n.tipo === "arvore");
  if (!recurso || !["tronco", "lascado"].includes(etapaRecursoCampo(id))) return null;
  const ox = d.origem.x / MUNDO.escala,
    oz = d.origem.y / MUNDO.escala,
    dist = Math.hypot(recurso.x - ox - d.px, recurso.z - oz - d.py);
  return dist - recurso.raio <= d.tile * 1.8 ? recurso : null;
}

/** Recurso do campo ao alcance das acoes de contexto (painel no canto). */
export function recursoCampoPerto() {
  const d = dungeon;
  if (!d.hero || d.mode !== "campo" || !d.origem || d.vila || d.camp || d.training) return null;
  const ox = d.origem.x / MUNDO.escala,
    oz = d.origem.y / MUNDO.escala;
  let melhor: RecursoCampo | null = null,
    menor = Infinity;
  for (const n of d.recursosCampo || []) {
    if (n.tipo !== "arvore") continue;
    const etapa = etapaRecursoCampo(n.id);
    if (etapa !== "arvore" && etapa !== "tronco" && etapa !== "lascado") continue;
    const dist = Math.hypot(n.x - ox - d.px, n.z - oz - d.py);
    if (dist - n.raio > d.tile * 1.7 || dist >= menor) continue;
    melhor = n;
    menor = dist;
  }
  if (!melhor) return null;
  const estado = world.recursosCampo?.[melhor.id];
  return {
    recurso: melhor,
    etapa: etapaRecursoCampo(melhor.id),
    qualidade: estado?.qualidade,
    madeiraRecolhida: !!estado?.madeiraRecolhida,
  };
}

/** E recolhe o rendimento normal do tronco; o corte verde rende madeira extra. */
export function interagirTroncoProximo() {
  const d = dungeon,
    h = d.hero;
  if (!h || d.mode !== "campo" || !d.origem || d.vila || d.camp || d.training) return null;
  const ox = d.origem.x / MUNDO.escala,
    oz = d.origem.y / MUNDO.escala;
  let alvo: RecursoCampo | null = null,
    distMin = Infinity;
  for (const n of d.recursosCampo || []) {
    if (n.tipo !== "arvore" || !["tronco", "lascado"].includes(etapaRecursoCampo(n.id))) continue;
    const dist = Math.hypot(n.x - ox - d.px, n.z - oz - d.py);
    if (dist - n.raio > d.tile * 1.5 || dist >= distMin) continue;
    alvo = n;
    distMin = dist;
  }
  if (!alvo) return null;
  const estado = world.recursosCampo?.[alvo.id];
  if (!estado) return null;
  if (estado.madeiraRecolhida) return null;
  const quantidade = estado.qualidade === "forte" ? 4 : estado.qualidade === "verde" ? 8 : 6,
    x = alvo.x - ox,
    z = alvo.z - oz;
  h.loot.wood = (h.loot.wood || 0) + quantidade;
  estado.madeiraRecolhida = true;
  if (estado.qualidade !== "verde") {
    estado.etapa = "toco";
    estado.quebrado = true;
    estado.galhos = 0;
    const crescimento = crescimentoAtual(estado);
    estado.crescimento = crescimento === "arvore" ? undefined : crescimento;
    marcarBlocoSujo(alvo.id);
  }
  return { quantidade, x, z };
}

/** O minijogo de conversao exige que a arvore tenha sido cortada no verde. Devolve a mensagem e onde ela aparece
    (coordenadas do campo, como as do herói). */
export function converterMadeiraEmGalho(id: string, qualidade: QualidadeCorte) {
  const d = dungeon,
    h = d.hero,
    estado = world.recursosCampo?.[id],
    alvo = (d.recursosCampo || []).find((n) => n.id === id);
  if (!h || !d.origem || !alvo || !estado || (estado.etapa !== "tronco" && estado.etapa !== "lascado")) return null;
  const x = alvo.x - d.origem.x / MUNDO.escala,
    z = alvo.z - d.origem.y / MUNDO.escala,
    aviso = (texto: string) => ({ texto, ok: false, x, z });
  if (estado.qualidade !== "verde" || qualidade === "forte") return aviso("Esse tronco não permite fazer galho.");
  if (qualidade !== "verde") return aviso("Solte no verde para transformar madeira em galho.");
  if (!estado.madeiraRecolhida) {
    h.loot.wood = (h.loot.wood || 0) + 8;
    estado.madeiraRecolhida = true;
  }
  if ((h.loot.wood || 0) < 2) return aviso("Precisa de 2 madeiras para fazer um galho.");
  h.loot.wood -= 2;
  (d.loot ||= []).push({ key: "galho", x, y: z, t: 0, ttl: 0, expiraEm: world.tick + GALHO_DURA });
  estado.etapa = "toco";
  estado.quebrado = true;
  estado.galhos = 0;
  const crescimento = crescimentoAtual(estado);
  estado.crescimento = crescimento === "arvore" ? undefined : crescimento;
  marcarBlocoSujo(id);
  return { texto: "2 madeiras transformadas em 1 galho.", ok: true, x, z };
}

/** v8.1 — o que a picareta solta no chão em (x, z): a cada golpe, talvez uma pedra e talvez um minério
    (PEDRA_QUEBRA, ORE_TABLE); ao quebrar, as pedras do fim. Devolve os minérios que caíram (para o aviso). */
function soltarDaPedra(x: number, z: number, q: number, quebrou: boolean, verde: boolean) {
  const d = dungeon,
    P = PEDRA_QUEBRA,
    loot = (d.loot ||= []),
    expiraEm = world.tick + P.dura,
    perto = () => ({ x: x + (Math.random() - 0.5) * d.tile * 0.9, y: z + (Math.random() - 0.5) * d.tile * 0.9 }),
    minerios: string[] = [];
  let pedras = Math.random() < P.pedra ? 1 : 0;
  if (quebrou) pedras += P.fim + (verde ? 1 : 0);
  for (let i = 0; i < pedras; i++) loot.push({ key: "pedra", ground: true, t: 0, ttl: 0, expiraEm, ...perto() });
  let r = Math.random() / P.minerio[q];
  for (const [k, p] of ORE_TABLE) {
    if (r < p) {
      if (ITEM_DEFS[k]) {
        loot.push({ key: k, t: 0, ttl: 0, expiraEm, ...perto() });
        minerios.push(k);
      }
      break;
    }
    r -= p;
  }
  return minerios;
}

/** Golpe carregado em um recurso no arco da ferramenta: o machado corta árvore, a picareta quebra pedra (v8.1).
    Quantos golpes: GOLPES_RECURSO pelo tamanho e pela qualidade do golpe (a do minijogo, travado no começo; sem ele,
    pela carga). */
export function golpearRecursoCampo(
  carga: number,
  angulo: number,
  ferramenta: "machado" | "picareta" = "machado",
  qualidadeCorte?: QualidadeCorte,
  idForcado?: string,
) {
  const tipoAlvo = ferramenta === "picareta" ? "pedra" : "arvore";
  const d = dungeon,
    h = d.hero;
  if (!h || d.mode !== "campo" || !d.origem || d.vila || d.camp || d.training) return null;
  const origemX = d.origem.x / MUNDO.escala,
    origemZ = d.origem.y / MUNDO.escala,
    alcance = d.tile * 1.3;
  let alvo: RecursoCampo | null = null,
    distAlvo = Infinity,
    xAlvo = 0,
    zAlvo = 0;
  for (const n of d.recursosCampo || []) {
    if ((idForcado && n.id !== idForcado) || n.tipo !== tipoAlvo) continue;
    if (n.tipo === "arvore" ? etapaRecursoCampo(n.id) !== "arvore" : recursoCampoQuebrado(n.id)) continue;
    const x = n.x - origemX,
      z = n.z - origemZ,
      dx = x - d.px,
      dz = z - d.py,
      dist = Math.hypot(dx, dz),
      diff = Math.atan2(Math.sin(Math.atan2(dz, dx) - angulo), Math.cos(Math.atan2(dz, dx) - angulo));
    if (dist - n.raio > alcance || (!idForcado && Math.abs(diff) > 0.92) || dist >= distAlvo) continue;
    alvo = n;
    distAlvo = dist;
    xAlvo = x;
    zAlvo = z;
  }
  if (!alvo) return null;

  const estados = (world.recursosCampo ||= {}),
    estado = (estados[alvo.id] ||= { hp: alvo.maxHp, maxHp: alvo.maxHp }),
    qualidade = qualidadeCorte || (carga >= 0.84 ? "verde" : carga >= 0.55 ? "amarelo" : "laranja"),
    q = qualidade === "forte" || qualidade === "verde" ? 0 : qualidade === "amarelo" ? 1 : 2,
    tabela = GOLPES_RECURSO[alvo.tipo] || GOLPES_RECURSO.arvore,
    golpes = (tabela[alvo.porte] || tabela.medium)[q],
    dano = estado.maxHp / golpes; // vale para a vida em qualquer escala (os estados salvos antes guardam 2 a 4)
  gainSkill(h, alvo.tipo === "arvore" ? "lenhador" : "minerador", 1);
  estado.hp = Math.max(0, estado.hp - dano);
  estado.golpeEm = Date.now(); // a barrinha de vida aparece por um tempo (barrasRecursos)
  const quebrou = estado.hp <= estado.maxHp * 0.001;
  if (quebrou) estado.hp = 0;
  const minerios = alvo.tipo === "pedra" ? soltarDaPedra(xAlvo, zAlvo, q, quebrou, q === 0) : [];
  if (quebrou) {
    estado.quebrado = true;
    d.recursosCampoSujo = [...new Set([...(d.recursosCampoSujo || []), alvo.bloco])];
    if (alvo.tipo === "arvore") {
      estado.etapa = qualidadeCorte === "forte" ? "lascado" : "tronco";
      estado.bloco = alvo.bloco;
      estado.qualidade = qualidadeCorte || (carga >= 0.84 ? "verde" : carga >= 0.55 ? "amarelo" : "laranja");
      estado.sementeAte = world.tick + 3 * 24 * 60;
      estado.quedaInicioMs = Date.now();
      estado.quedaAteMs = estado.quedaInicioMs + 900;
      estado.quedaDirecao = Math.random() < 0.5 ? -1 : 1;
      const galhos =
        estado.qualidade === "forte" ? 0 : estado.qualidade === "verde" ? 4 : alvo.porte === "large" ? 3 : 2;
      estado.galhos = galhos;
      const loot = (d.loot ||= []);
      for (let i = 0; i < galhos; i++)
        loot.push({
          key: "galho",
          x: xAlvo + (Math.random() - 0.5) * d.tile,
          y: zAlvo + (Math.random() - 0.5) * d.tile,
          t: 0,
          ttl: 0,
          expiraEm: world.tick + GALHO_DURA,
        });
    }
  }
  return { recurso: alvo, x: xAlvo, z: zAlvo, hp: estado.hp, dano, quebrou, minerios };
}

/** v8.1 — a barrinha de vida, discreta, em cima da árvore ou da pedra golpeada (combatFx chama): aparece por uns
    segundos depois do golpe e enquanto a heroína está perto; some quando cai ou quebra. */
export function barrasRecursos(c: CanvasRenderingContext2D) {
  const d = dungeon,
    c0 = d.origem;
  if (!d.active || !c0 || d.mode !== "campo") return;
  const ox = c0.x / MUNDO.escala,
    oz = c0.y / MUNDO.escala,
    agora = Date.now(),
    T = d.tile;
  for (const n of d.recursosCampo || []) {
    const e = world.recursosCampo?.[n.id];
    if (!e || !(e.hp > 0) || e.hp >= e.maxHp || etapaRecursoCampo(n.id) !== "arvore") continue;
    const x = n.x - ox,
      z = n.z - oz,
      perto = Math.hypot(x - d.px, z - d.py) < T * 2.2;
    if (!perto && agora - (e.golpeEm || 0) > 8000) continue;
    const w = 20,
      f = Math.max(0, Math.min(1, e.hp / e.maxHp)),
      desenha = () => {
        c.fillStyle = "rgba(10,8,5,.6)";
        c.fillRect(x - w / 2 - 1, z - 1, w + 2, 4);
        c.fillStyle = "rgba(236,226,196,.88)";
        c.fillRect(x - w / 2, z, w * f, 2);
      };
    c.save();
    if (D3.on) d3Bill(x, z, n.tipo === "arvore" ? 34 : 16, desenha);
    else {
      c.translate(0, -(n.tipo === "arvore" ? 30 : 14));
      desenha();
    }
    c.restore();
  }
}
