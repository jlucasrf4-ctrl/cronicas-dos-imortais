/* ==== Modelos completos vestidos no esqueleto da heroína (src/assets/models/vestidos.json, tools/juntar-vestidos.ts):
   NPCs, equipamento e os seis corpos padrão das recrutas ====
   Para testar as interações com outra aparência (mantenedor, 2026-10-25): na sala de treino (field/treino.ts) eles
   ficam de pé em fila, como manequins (monstros `dummy` com model "vestido:<nome>"), e o E perto de um veste a heroína
   com ele — a malha troca, os clips continuam os da heroína (animado.ts, trocarPele). A aparência fica ao sair da
   sala (para testar o acampamento, a vila…); E no mesmo manequim de novo, ou o GameShark HEROINA, volta a heroína.
   Cada manequim é um animado parado, com a malha dele e a pose "parada" da heroína. ==== */
import { M4 } from "./geometria.ts";
import { ocultarPeleCoberta } from "./cobertura-roupa.ts";
import { glPush } from "./renderer.ts";
import { novoAnimado, animar, animarNoInstanteDe, trocarPele, type SituacaoAnim } from "./animado.ts";
import { dadosHeroina, novoComoHeroina, vestirHeroina, vestirHeroinaPecas } from "./heroina_anim.ts";
import { peleDaAparencia, cabecaDaAparencia, type Aparencia } from "./aparencias.ts";
import type { DadosAnim } from "./esqueleto.ts";
import { dungeon } from "../../core/state.ts";
import { dadosCacador } from "./cacador_anim.ts";
import { GL3 } from "../../core/state.ts";
import type { GLMesh } from "../../core/tipos.ts";
import { DANO } from "../../data/combate.ts";
import { INTEGRAIS_FORA } from "../../data/aparencias.ts";
import type { Equip, Item } from "../../core/tipos.ts";

interface Vestido {
  nome: string;
  rotulo: string;
  anim?: DadosAnim;
  proprio?: boolean;
  /** Peças preparadas para uma combinação específica não viram manequins separados. */
  interno?: boolean;
  partes?: Partial<Record<"peito" | "pernas" | "pes", DadosAnim>>;
}
// o marcador precisa de `{}` logo depois do comentário (o plugin troca os dois pelo JSON); nos testes em Node fica vazio
const DADOS = /* @inline-json src/assets/models/vestidos.json */ {} as {
  modelos?: Vestido[];
  texturas?: Record<string, string>;
};
for (const v of DADOS.modelos ?? [])
  for (const d of [v.anim, ...Object.values(v.partes ?? {})]) if (d?.texDe) d.tex = DADOS.texturas?.[d.texDe];

/** Escala no mundo (a mesma da heroína animada, SC do renderer). */
const MANEQUIM = { escala: 1.3 };

/** Os personagens, na ordem da fila (vazio sem os dados: testes em Node). Roupa interna não vira manequim. */
export function vestidos(): Vestido[] {
  return (DADOS.modelos ?? []).filter(
    (v) => !v.proprio && !v.interno && !/^corpo_f0[1-6]__(deserto|patrulheira|placa)$/.test(v.nome),
  );
}
export function vestidoPorNome(nome: string) {
  return (DADOS.modelos ?? []).find((v) => v.nome === nome) ?? null;
}

/** Quem a heroína está vestindo (null = ela mesma) e qual personagem vestiu (id; a roupa só vale para ele —
    mantenedor 2026-10-25: depois do GameShark OUTONO todo personagem criado "sempre cai na D. outono"). */
export const VESTIDO = { atual: null as string | null, heroi: null as string | null };
/** Veste o personagem do campo (ou `heroi`) com o personagem (null ou o mesmo de novo = volta a ser ele). Devolve o
    rótulo vestido ou null. */
export function vestir(nome: string | null, heroi: string | null = dungeon.hero?.id ?? null) {
  const v = nome && nome !== VESTIDO.atual ? vestidoPorNome(nome) : null;
  const modelo = v?.anim && !v.proprio ? v : null;
  VESTIDO.atual = modelo?.nome ?? null;
  VESTIDO.heroi = modelo ? heroi : null;
  vestirHeroina(modelo?.anim ?? null);
  vestirHeroinaPecas(null, null);
  return modelo?.rotulo ?? null;
}

/** v8.0 — a cabeça própria de cada corpo das aparências sorteadas (aparencias.ts): a líder é a dos manequins; v8.1 —
 *  os corpos das deusas têm o nome do personagem vestido. */
const PROPRIA: Record<string, string> = { lider: "lider_bandidos" };
const VARIANTES_COURO = ["aventureira", "deserto", "patrulheira"] as const;
type VisualRoupa = NonNullable<Item["visualRoupa"]>;
const VISUAIS_ROUPA: readonly VisualRoupa[] = [...VARIANTES_COURO, "placa"];
const sortearCouro = (): VisualRoupa => VARIANTES_COURO[Math.floor(Math.random() * VARIANTES_COURO.length)];
function visualDo(item: Item | null | undefined, aceitos: readonly VisualRoupa[] = VISUAIS_ROUPA, sortear = false) {
  if (!item?.def) return undefined;
  if (item.visualRoupa && aceitos.includes(item.visualRoupa)) return item.visualRoupa;
  if (!sortear) return undefined;
  const novo = sortearCouro();
  item.visualRoupa = novo;
  return novo;
}

/** Prefere peças ajustadas ao par corpo/cabeça; estilos ainda não preparados usam o corpo de referência. */
export function roupaDaAparencia(visual: Aparencia | undefined, modelo: string, obter = vestidoPorNome) {
  const corpo = !visual?.corpo || visual.corpo === "heroina" || visual.corpo === "lider" ? "corpo_f01" : visual.corpo;
  if (!/^corpo_f0[1-6]$/.test(corpo)) return null;
  // as roupas feitas para um busto integral só servem nele (2026-11-07: a F16 da F02 deixou de usar o dela)
  const cab = visual ? cabecaDaAparencia(visual) : null,
    porCombinacao = cab && !INTEGRAIS_FORA.includes(corpo + "|" + cab) ? obter(`${corpo}__${cab}__${modelo}`) : null;
  return porCombinacao?.partes ? porCombinacao : obter(`${corpo}__${modelo}`);
}

/** Peito, calça e botas usam camadas animadas independentes e mantêm o último estilo em cada item. */
function partesDaArmadura(visual: Aparencia | undefined, equip?: Equip) {
  const peito = equip?.peito,
    pernas = equip?.pernas,
    pes = equip?.pes;
  let modelo: string | undefined;
  let material: string | undefined;
  if (peito?.def) {
    material = DANO.ARMADURAS[peito.def.key]?.m ?? peito.def.mat;
    if (material === "placa") modelo = "placa";
    else if (material === "couro") modelo = visualDo(peito, VARIANTES_COURO, true);
    else if (material === "malha") modelo = "placa"; // a cota ainda não tem malha própria; usa a silhueta pesada disponível
  } else {
    modelo = visualDo(pernas, VISUAIS_ROUPA, !!pernas?.def) ?? visualDo(pes, VISUAIS_ROUPA, !!pes?.def);
  }
  if (!modelo || !VISUAIS_ROUPA.includes(modelo as (typeof VISUAIS_ROUPA)[number])) return null;
  if (peito?.def) peito.visualRoupa = modelo as VisualRoupa;
  if (pernas?.def) pernas.visualRoupa = modelo as VisualRoupa;
  if (pes?.def) pes.visualRoupa = modelo as VisualRoupa;

  const vestido = roupaDaAparencia(visual, modelo);
  if (!vestido?.partes) return null;
  return {
    peito:
      peito?.def && (material === "couro" || material === "placa" || material === "malha")
        ? (vestido.partes.peito ?? null)
        : null,
    pernas: pernas?.def ? (vestido.partes.pernas ?? null) : null,
    pes: pes?.def ? (vestido.partes.pes ?? null) : null,
  };
}

/**
 * O herói em campo usa o modelo correspondente à armadura equipada. A sala de treino (VESTIDO.atual) continua como
 * sobreposição temporária para experimentar qualquer modelo. Chamado a cada quadro antes de animar.
 */
export function vestirComoHeroi(visual: Aparencia | undefined, heroi?: string, equip?: Equip) {
  // A troca completa é somente uma prévia de manequim na sala de treino; no campo prevalecem corpo e cabeça próprios.
  const v =
    dungeon.training && VESTIDO.atual && (!VESTIDO.heroi || VESTIDO.heroi === heroi)
      ? vestidoPorNome(VESTIDO.atual)
      : null;
  if (v?.anim) {
    vestirHeroina(v.anim);
    vestirHeroinaPecas(null, null);
    return;
  }
  const partes = partesVestidas(visual, equip);
  vestirHeroina(ocultarPeleCoberta(peleDoVisual(visual, partes?.peito), [partes?.peito, partes?.pernas, partes?.pes]));
  vestirHeroinaPecas(partes?.peito ?? null, partes?.pernas ?? null, partes?.pes ?? null);
}
function partesVestidas(visual: Aparencia | undefined, equip?: Equip) {
  return partesDaArmadura(visual, equip);
}
/** A pele de uma aparência (null = a heroína de sempre), com a cabeça própria da líder vinda dos manequins.
 *  2026-11-07 — `peito`: o peitoral vestido (a gola do pescoço só cobre o que ele deixa à mostra). */
export function peleDoVisual(visual: Aparencia | undefined, peito?: DadosAnim | null) {
  return peleDaAparencia(
    visual,
    (corpo) => {
      if (/^corpo_f0[1-6]$/.test(corpo)) return vestidoPorNome(corpo)?.anim ?? null;
      return corpo === "heroina" ? dadosHeroina() : (vestidoPorNome(PROPRIA[corpo] ?? corpo)?.anim ?? null);
    },
    undefined,
    peito,
  );
}

/* ---------- v8.0 — o personagem sorteado no retrato da criação: animado de verdade, parado, sem armas ---------- */
const RETRATO = { X: null as ReturnType<typeof novoAnimado> | null, t: 0 };
const RETRATO_PEITO = novoComoHeroina();
const RETRATO_PERNAS = novoComoHeroina();
const RETRATO_PES = novoComoHeroina();
const PREVIA = { nome: "", X: null as ReturnType<typeof novoAnimado> | null };
/** Modelos do teste: só o selecionado é animado; as criaturas conservam seu próprio esqueleto. */
export function modelosTeste() {
  return [
    { nome: "heroina", rotulo: "Heroína", anim: dadosHeroina() },
    { nome: "cacador", rotulo: "Caçador", anim: dadosCacador(), proprio: true },
    ...(DADOS.modelos ?? []).filter((v) => v.anim && !v.interno),
  ];
}
export function clipsModeloTeste(nome: string) {
  const v = modelosTeste().find((m) => m.nome === nome);
  return Object.keys((v && "proprio" in v && v.proprio ? v.anim : dadosHeroina())?.clips ?? {});
}
export function desenharModeloTeste(nome: string, yaw: number, clip: string, tempo: number, visual?: Aparencia) {
  const v = modelosTeste().find((m) => m.nome === nome);
  if (!v?.anim) return null;
  if (PREVIA.nome !== nome || !PREVIA.X) {
    const ant = PREVIA.X;
    if (ant?.gl && ant.mesh) {
      for (const b of ant.bufs) ant.gl.deleteBuffer(b);
      if (ant.mesh.vao) ant.gl.deleteVertexArray(ant.mesh.vao);
    }
    PREVIA.nome = nome;
    PREVIA.X = novoAnimado(
      "proprio" in v && v.proprio ? v.anim : dadosHeroina(),
      { passoAndar: 80, passoCorrer: 158, rolarDur: 0.6, coletarDur: 0.8, troca: 0.15, paradaRelaxada: true },
      () => ({}),
    );
  }
  const X = PREVIA.X;
  const propria = "proprio" in v && v.proprio;
  X.aj.paradaRelaxada = !propria;
  trocarPele(X, propria ? null : visual ? peleDoVisual(visual) : v.anim);
  const dadosClip = (propria ? v.anim : dadosHeroina()).clips[clip];
  if (!dadosClip) return null;
  const dur = (dadosClip.n - 1) / dadosClip.fps;
  const t = clip === "morrer" ? Math.min(tempo, dur) : tempo % Math.max(dur, 0.001);
  // A prévia amostra o clip diretamente. Com dt=0 a mistura inicial ficaria presa na pose vazia.
  X.estado = "fixo:" + clip;
  X.troca = X.aj.troca;
  const an = animar(X, { dt: 0, andou: 0, fixo: { clip, t } });
  if (!an) return null;
  const base = M4.ch(M4.RY(-yaw), M4.S(MANEQUIM.escala));
  glPush(an.mesh, base);
  return { X, mat: an.mat, base };
}
/** Medidas do último quadro, usadas pela conferência automática da prévia. */
export function quadroModeloTeste() {
  const p = PREVIA.X?.def?.p;
  let minY = Infinity,
    maxY = -Infinity,
    assinatura = 0;
  if (p)
    for (let i = 0; i < p.length; i++) {
      assinatura += p[i] * ((i % 17) + 1);
      if (i % 3 === 1) {
        minY = Math.min(minY, p[i]);
        maxY = Math.max(maxY, p[i]);
      }
    }
  return { nome: PREVIA.nome, minY, maxY, assinatura };
}
/** Põe na lista de desenho o personagem com a aparência `visual`, na origem, virado para `yaw` (rad), na pose
 *  parada da heroína (as armas não fazem parte da malha: ficam de fora). v8.1: `acao` = o resto da situação (a
 *  demonstração da criação: golpes, machado, lança — render/retrato.ts); devolve o animado, a pose e a matriz do corpo
 *  (para prender a arma: preso(X, mat, "arma")), ou null sem animação. */
export function desenharRetratoVivo(
  visual: Aparencia | undefined,
  yaw: number,
  acao: Partial<SituacaoAnim> = {},
  equip?: Equip,
) {
  if (!RETRATO.X) RETRATO.X = novoComoHeroina(); // v8.1: com as peças presas da heroína (a arma da demonstração)
  const X = RETRATO.X;
  const partes = partesVestidas(visual, equip);
  trocarPele(X, ocultarPeleCoberta(peleDoVisual(visual, partes?.peito), [partes?.peito, partes?.pernas, partes?.pes]));
  const agora = performance.now(),
    dt = RETRATO.t ? Math.min(0.1, (agora - RETRATO.t) / 1000) : 0;
  RETRATO.t = agora;
  const situacao = { ...acao, dt, andou: 0 };
  trocarPele(RETRATO_PEITO, partes?.peito ?? null);
  trocarPele(RETRATO_PERNAS, partes?.pernas ?? null);
  trocarPele(RETRATO_PES, partes?.pes ?? null);
  const an = animar(X, situacao);
  if (!an) return null;
  const base = M4.ch(M4.RY(-yaw), M4.S(MANEQUIM.escala));
  glPush(an.mesh, base);
  const pernas = partes?.pernas ? animarNoInstanteDe(RETRATO_PERNAS, X, situacao) : null,
    peito = partes?.peito ? animarNoInstanteDe(RETRATO_PEITO, X, situacao) : null,
    pes = partes?.pes ? animarNoInstanteDe(RETRATO_PES, X, situacao) : null;
  if (pernas) glPush(pernas.mesh, base);
  if (pes) glPush(pes.mesh, base);
  if (peito) glPush(peito.mesh, base);
  return { X, mat: an.mat, base };
}

/* ---------- v8.1 — as aparências lado a lado (controle de qualidade do Modo Editor, editor/aparencias_qc.ts) ---------- */
const GALERIA = new Map<string, { X: ReturnType<typeof novoAnimado>; mesh: GLMesh | null }>();
/** Desenha a aparência `visual` parada em (x, z), virada para `ang`, como os manequins (deformada uma vez só). */
export function desenharAparencia(visual: Aparencia, x: number, z: number, ang: number, tint: number[] | null) {
  const k = visual.corpo + "|" + visual.cabeca;
  let q = GALERIA.get(k);
  if (!q) {
    const X = novoAnimado(
      dadosHeroina(),
      { passoAndar: 80, passoCorrer: 158, rolarDur: 0.6, coletarDur: 0.8, troca: 0.15, paradaRelaxada: true },
      () => ({}),
    );
    trocarPele(X, peleDoVisual(visual));
    GALERIA.set(k, (q = { X, mesh: null }));
  }
  if (!q.mesh || q.X.gl !== GL3.gl) q.mesh = animar(q.X, { dt: 0, andou: 0 })?.mesh ?? null;
  if (!q.mesh) return;
  glPush(q.mesh, M4.ch(M4.T(x, 0, z), M4.RY(-ang), M4.S(MANEQUIM.escala)), tint);
}

/* ---------- manequins ---------- */
/* Parados de verdade: a malha é deformada uma vez (pose "parada") e depois só redesenhada. Animados a cada quadro,
   os ~14 corpos (deformação no processador + normais suaves + reenvio à placa) travavam a sala de treino. */
const MANEQUINS = new Map<string, { X: ReturnType<typeof novoAnimado>; mesh: GLMesh | null }>();
/** Desenha o manequim `nome` em (x, z), virado para o ângulo `ang` (rad, como o yaw da heroína). */
export function desenharManequim(nome: string, x: number, z: number, ang: number, tint: number[] | null) {
  const v = vestidoPorNome(nome);
  if (!v?.anim) return;
  let q = MANEQUINS.get(nome);
  if (!q) {
    const X = novoAnimado(
      dadosHeroina(),
      { passoAndar: 80, passoCorrer: 158, rolarDur: 0.6, coletarDur: 0.8, troca: 0.15, paradaRelaxada: true },
      () => ({}),
    );
    trocarPele(X, v.anim);
    MANEQUINS.set(nome, (q = { X, mesh: null }));
  }
  // de novo só se a malha sumiu (contexto WebGL novo)
  if (!q.mesh || q.X.gl !== GL3.gl) q.mesh = animar(q.X, { dt: 0, andou: 0 })?.mesh ?? null;
  if (!q.mesh) return;
  glPush(q.mesh, M4.ch(M4.T(x, 0, z), M4.RY(-ang), M4.S(MANEQUIM.escala)), tint);
}
