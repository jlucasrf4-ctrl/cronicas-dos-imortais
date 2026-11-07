/* ==== v7.7 — fluxo de caça: achou a presa no mapa, entra no campo para derrubá-la (pedido do mantenedor, 2026-10-12;
   decisões de 2026-10-12 e 2026-10-18) ====
   Na caça automática de coelho ou cervo, a primeira presa que a heroína alcança vira uma caçada: um aviso no mapa e,
   em CACADA.aviso ms, o mergulho no campo (map/transicao.ts). Esc ou um clique no aviso dispensa: a caça segue
   automática, como antes. Se você já está no campo com outra heroína, a dela segue automática.
   No campo a presa nasce longe, marcada como foco, com um cronômetro (CACADA.tempo). Derrubou: a carne e a pele caem
   como sempre; ao sair, a caça no mapa continua com o rendimento normal. O tempo acabou: ela corre para a borda e foge
   (critAI em field/campo_vida.ts), a heroína volta sozinha ao mapa e o resto da caça dá menos carne (CACADA.fracasso).
   Sair antes de derrubar conta como fuga. Uma caçada por ordem de caça (task.cacada).
   v8.1 (mantenedor, 2026-10-30, vários personagens trabalhando sozinhos: "o jogo nunca te puxa"): o aviso não
   mergulha mais sozinho. Clicar nele entra no campo; ignorado por CACADA.aviso ms (ou Esc), a caça segue automática. */
import { dungeon } from "../core/state.ts";
import { CACADA } from "../data/mapa.ts";
import { CRIT_SP } from "../data/campo.ts";
import { critSpawn, loboNeutro } from "../field/campo_vida.ts";
import { spawnJavalino } from "../creatures/javali.ts";
import { setBanner, spawnDungeonToast } from "../field/masmorra.ts";
import { killAnimal } from "../sim/animais.ts";
import { killWild } from "../sim/fauna.ts";
import { pushEvent } from "../sim/eventos.ts";
import { anyGameModal } from "../ui/titulo.ts";
import { updateHeroPanelUI } from "../ui/painel.ts";
import { entrarNoCampo, sairDoCampo } from "./transicao.ts";
import { ligarBicho, pontoPerto } from "./mundo.ts";
import { rastroIni, rastroAbate } from "../field/rastro.ts";
import type { Animal, Hero, Monster, Wild } from "../core/tipos.ts";

type Tarefa = NonNullable<Hero["task"]>;
interface CacadaCampo {
  h: Hero;
  task: Tarefa;
  alvo: Animal | Wild; // o bicho do mapa (morre no mapa se você o derrubar; a raposa é de world.wild)
  sp: string;
  sess: number;
  m: Monster | null; // a presa no campo
  t: number; // s que faltam
  fim: string; // "" | "ok" | "fugiu"
}
interface EstadoCAC {
  aviso: { h: Hero; alvo: Animal | Wild; timer: number } | null;
  pend: { h: Hero; t0: number } | null; // o mergulho começou: startExpedition põe a presa (cacadaNoCampo)
  campo: CacadaCampo | null;
}
const CAC: EstadoCAC = { aviso: null, pend: null, campo: null };

/** Nome do bicho com artigo ("um cervo"). */
function umBicho(sp: string) {
  if (sp === "fox") return "uma raposa";
  const n = ({ wolf: "lobo", boar: "javali" } as Record<string, string>)[sp];
  return "um " + (n || (CRIT_SP[sp] ? CRIT_SP[sp].n.toLowerCase() : sp));
}
/** O bicho do mapa morre: a raposa é de world.wild (sim/fauna.ts), os outros de world.animals. */
function matarNoMapa(alvo: Animal | Wild, causa: string) {
  if (alvo.species === "fox") killWild(alvo as Wild, causa);
  else killAnimal(alvo as Animal, causa);
}
/** A presa no campo: o lobo é o lobo neutro (field/campo_vida.ts, loboAI), o javali é o Javalino
    (creatures/javali.ts); coelho e cervo, bichos do campo. */
function presaNova(sp: string) {
  return sp === "wolf" ? loboNeutro() : sp === "boar" ? spawnJavalino(1) : critSpawn(sp);
}

/**
 * Caça automática (huntStep): a heroína alcançou a presa `t`. true = virou caçada (ou o aviso já está na tela) e a
 * caça automática não rola o abate agora.
 */
export function cacadaAchou(h: Hero, t: Animal | Wild) {
  const T = h.task;
  if (!T || h.state !== "hunting") return false;
  if (T.cacada === "aviso") return true;
  if (T.cacada || !CACADA.especies.includes(T.targetSpecies)) return false;
  limparVelha();
  if (dungeon.active || CAC.aviso || CAC.campo) {
    T.cacada = "auto";
    return false;
  }
  T.cacada = "aviso";
  CAC.aviso = { h, alvo: t, timer: window.setTimeout(() => cacadaDispensar(), CACADA.aviso) };
  mostrarAviso(h, T.targetSpecies);
  pushEvent("🐾 " + h.name + " achou " + umBicho(T.targetSpecies) + "!");
  return true;
}

function avisoEl() {
  let el = document.getElementById("cacada-aviso");
  if (!el) {
    el = document.createElement("div");
    el.id = "cacada-aviso";
    el.addEventListener("click", mergulhar);
    document.body.appendChild(el);
  }
  return el;
}
function mostrarAviso(h: Hero, sp: string) {
  const el = avisoEl();
  el.innerHTML =
    "🐾 <b>" +
    h.name +
    "</b> achou " +
    umBicho(sp) +
    "! <u>Clique para caçar no campo</u><small>ou deixe: ela caça sozinha</small><i></i>";
  el.style.setProperty("--ms", CACADA.aviso + "ms");
  el.classList.remove("on");
  void el.offsetWidth; // recomeça a barra
  el.classList.add("on");
}
function esconderAviso() {
  const el = document.getElementById("cacada-aviso");
  if (el) el.classList.remove("on");
}

/** Esc (ou clique no aviso): a caça segue automática. true = havia um aviso. */
export function cacadaDispensar() {
  const A = CAC.aviso;
  if (!A) return false;
  clearTimeout(A.timer);
  CAC.aviso = null;
  esconderAviso();
  if (A.h.task && A.h.task.cacada === "aviso") A.h.task.cacada = "auto";
  pushEvent("🐾 " + A.h.name + " segue caçando sozinha.");
  return true;
}

function mergulhar() {
  const A = CAC.aviso;
  if (!A) return;
  const h = A.h,
    T = h.task;
  // mudou algo nesses segundos (outra ordem, um menu aberto, o bicho morreu): segue automática
  if (
    !T ||
    T.cacada !== "aviso" ||
    h.state !== "hunting" ||
    A.alvo.alive === false ||
    dungeon.active ||
    anyGameModal()
  ) {
    cacadaDispensar();
    return;
  }
  CAC.aviso = null;
  esconderAviso();
  T.cacada = "campo";
  CAC.pend = { h, t0: performance.now() };
  CAC.campo = {
    h,
    task: T,
    alvo: A.alvo,
    sp: T.targetSpecies,
    sess: -1,
    m: null,
    t: CACADA.tempo,
    fim: "",
  };
  entrarNoCampo(h, true);
  if (h.state === "hunting") limpar(); // recusada na hora: segue automática
}
/** v8.1 — ela está no campo por causa de uma caçada (os bandidos da noite não vêm no meio: map/perigo.ts). */
export function emCacada() {
  return !!CAC.campo && (CAC.campo.sess === -1 || CAC.campo.sess === dungeon.sess);
}
/** Esquece a caçada (recusada, ou a heroína não voltou do campo pelo caminho de sempre). */
function limpar() {
  const C = CAC.campo;
  if (C && C.task.cacada === "campo") C.task.cacada = "auto";
  CAC.campo = null;
  CAC.pend = null;
  hud(null);
}
/** Uma caçada que ficou para trás: o mergulho não abriu o campo, ou o campo fechou sem cacadaRetomar. */
function limparVelha() {
  const C = CAC.campo;
  if (!C) return;
  const naoAbriu = C.sess === -1 && (!CAC.pend || performance.now() - CAC.pend.t0 > 8000);
  if (naoAbriu || (C.sess !== -1 && !dungeon.active)) limpar();
}

/** startExpedition, no campo: põe a presa da caçada (se esta entrada veio de uma). */
export function cacadaNoCampo() {
  const P = CAC.pend,
    C = CAC.campo,
    d = dungeon;
  CAC.pend = null;
  if (!P || !C || d.hero !== P.h || performance.now() - P.t0 > 8000) return;
  const T = d.tile;
  let m: Monster = presaNova(C.sp);
  for (let i = 0; i < 12 && Math.hypot(m.x - d.px, m.y - d.py) < T * CACADA.distIni; i++) {
    d.monsters = d.monsters.filter((o) => o !== m);
    m = presaNova(C.sp);
  }
  const longe = pontoPerto(CACADA.longe[0], CACADA.longe[1]); // v8.0: no campo aberto, bem mais longe
  if (longe) ({ x: m.x, y: m.y } = longe);
  m.cacada = true;
  // v8.0: no campo aberto é o mesmo bicho do mapa (map/mundo.ts); v8.1: a raposa (world.wild) também
  ligarBicho(m, C.alvo);
  const visivel = rastroIni(m); // v8.0: as pegadas levam até ela, ou só há fezes pelo caminho (field/rastro.ts)
  d.foco = m;
  C.m = m;
  C.sess = d.sess;
  C.t = CACADA.tempo;
  setBanner(
    "🐾 Caçada: " + m.name,
    (visivel ? "siga as pegadas" : "nenhuma pegada à vista · procure fezes por perto") + " · " + relogio(C.t),
    4.5,
    "#ffd27a",
  );
  hud(C);
}

function relogio(s: number) {
  s = Math.max(0, Math.ceil(s));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}
function hud(C: CacadaCampo | null) {
  const v = document.getElementById("dungeon-view");
  let el = document.getElementById("cacada-hud");
  if (!el && C && v) {
    el = document.createElement("div");
    el.id = "cacada-hud";
    v.appendChild(el);
  }
  if (!el) return;
  if (!C || !C.m) {
    el.classList.remove("on");
    return;
  }
  const txt =
    C.fim === "ok"
      ? "🏹 " + C.m.name + " abatido"
      : C.fim === "fugiu"
        ? "💨 " + C.m.name + " fugiu"
        : (C.m.cacFuga ? "💨 fugindo" : "🐾 " + C.m.name) + " · " + relogio(C.t);
  if (el.textContent !== txt) el.textContent = txt;
  el.classList.add("on");
  el.classList.toggle("fim", !!C.fim);
  el.classList.toggle("urgente", !C.fim && C.t <= 15);
}

/** Tique do campo (updateDungeonFlow): cronômetro, fuga e fim. */
export function cacadaTick(dt: number) {
  const C = CAC.campo,
    d = dungeon;
  if (!C || !C.m || C.sess !== d.sess || !d.active || d.dead) return;
  const m = C.m;
  if (!C.fim) {
    if (!m.alive) {
      // morreu sem ser por você (o lobo) ou saiu pela borda
      fugiu(C, m.fugiu ? "💨 " + m.name + " fugiu" : "🐺 Outro bicho levou a presa");
    } else {
      C.t -= dt;
      if (C.t <= 0 && !m.cacFuga && !m.bound && !m.crav) {
        m.cacFuga = true;
        if (m.neutral) m.fugir = true; // o lobo: loboAI o leva para longe (o bravo segue brigando)
        m.st = "flee";
        spawnDungeonToast("💨 fugindo!", m.x, m.y - 30, "#ffb37a", 13);
      }
    }
  }
  hud(C);
}
function fugiu(C: CacadaCampo, txt: string) {
  C.fim = "fugiu";
  if (dungeon.foco === C.m) dungeon.foco = null;
  setBanner(txt, "voltando ao mapa · a caça segue sozinha, mais fraca", 3, "#ff9a7a");
  const sess = C.sess;
  let n = 0;
  const voltar = () => {
    const d = dungeon;
    if (!d.active || d.sess !== sess || d.dead || CAC.campo !== C) return;
    sairDoCampo(); // recusa com um menu aberto: tenta de novo
    if (n++ < 30) setTimeout(voltar, 700);
  };
  setTimeout(voltar, CACADA.volta);
}

/** onMonsterKilled: você derrubou a presa. */
export function cacadaAbatida(m: Monster) {
  const C = CAC.campo;
  if (!C || C.m !== m || C.fim) return;
  C.fim = "ok";
  rastroAbate(); // v8.0: a perícia Rastreio
  hud(C);
  setBanner("🏹 Caçada concluída!", "pegue a carne · role para fora para voltar ao mapa", 5, "#9fe38a");
}

/** exitDungeon, a heroína de volta ao mapa: a caça dela continua (automática). */
export function cacadaRetomar(h: Hero) {
  const C = CAC.campo;
  if (!C || C.h !== h) return;
  CAC.campo = null;
  hud(null);
  if (h.state !== "field") return;
  const T = C.task,
    ok = C.fim === "ok";
  T.cacada = ok ? "ok" : "fugiu";
  if (ok) {
    T.killsDone++;
    if (C.alvo.alive !== false) matarNoMapa(C.alvo, "caçado por " + h.name);
  } else T.fraca = true;
  h.task = T;
  h.state = "hunting";
  h.targetEntity = null;
  h.localTarget = null;
  pushEvent(
    ok
      ? "🏹 " + h.name + " derrubou " + umBicho(C.sp) + " e segue caçando."
      : "💨 " +
          umBicho(C.sp).replace(/^uma/, "A").replace(/^um/, "O") +
          " fugiu. " +
          h.name +
          " segue caçando, com menos carne.",
  );
  updateHeroPanelUI();
}
