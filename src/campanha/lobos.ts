/* ==== v7.7 — campanha C2, passo 1b (docs/campanha.md): o lobo do Caçador ====
   Com a missão "Um lobo vivo" (a3_lobo), toda expedição tem um lobo (campoPovoar pergunta querLobo). Laçado e
   cansado até cair (o "dominado" do laço, field/faca_corda.ts), a decisão é no próprio jogo, sem janela (mantenedor,
   2026-10-18): chegar perto e finalizar com a faca (E) = abate limpo (o Caçador lamenta, precisava dele vivo, e a
   missão volta a "lace outro"); esperar ele levantar ainda na corda = domado (a missão passa a "leve pela corda até
   a saída"; ele anda atrás de você e dá pinote quando o fôlego interno enche, tabela DOMA). Saindo do campo com ele
   na corda (caído ou domado), ele vai para o cercado (econ.lobos) com o mesmo sexo, pelagem e ficha (FichaLobo) e o
   Caçador chama (a3_cercado). Se ele escapa, a missão
   volta. A primeira mordida que pega durante a missão rasga a roupa do peito (a armadura que rasga, decisão 4). */
import { dungeon, econ, world } from "../core/state.ts";
import { FALAS_CURTAS } from "../data/campanha.ts";
import { campanha, campanhaEvento, campanhaIr, missaoAtual } from "./campanha.ts";
import { setBanner, spawnDungeonToast } from "../field/masmorra.ts";
import { ensureFol } from "../field/dano.ts";
import { ensureEquip } from "../items/equipamento.ts";
import { eqDurInit, eqWear } from "../items/durabilidade.ts";
import { pushEvent } from "../sim/eventos.ts";
import type { LoboCercado, Monster } from "../core/tipos.ts";

/** Segundos dos letreiros do Caçador no campo. */
const LOBO_T = { banner: 4.5 };

function etapa() {
  return campanha().etapa;
}
/** Um lobo comum do campo (os da masmorra e o neutro): nem bicho pequeno, nem boneco, nem javali, nem o Alfa. */
function ehLobo(m: Monster) {
  return !!(m && !m.critter && !m.dummy && !m.kind && !m.boss && !m.intro && m.atk === "bite");
}
/** A missão pede um lobo: a expedição garante um (campoPovoar). */
export function querLobo() {
  return etapa() === "a3_lobo" && !!missaoAtual();
}

/** O lobo da missão (o que foi derrubado na corda nesta expedição). */
const LB = { m: null as Monster | null };

/** O laço derrubou o bicho (lacoTick). Na missão, o letreiro diz as duas saídas: abater ou esperar ele levantar. */
export function loboDominado(m: Monster) {
  if (!querLobo() || !ehLobo(m)) return;
  LB.m = m;
  setBanner("🪢 Lobo caído", FALAS_CURTAS.loboCaido, LOBO_T.banner);
}

/** O lobo caído levantou ainda na corda (lacoTick): domado, a missão passa a levá-lo até a saída. */
export function loboLevantou(m: Monster) {
  if (!querLobo() || !ehLobo(m)) return;
  LB.m = m;
  campanhaEvento("loboDerrubado");
  setBanner("🐺 Domado", FALAS_CURTAS.loboDomado, LOBO_T.banner);
}

/** Saindo do campo (exitDungeon): o lobo na corda (caído ou domado) vai para o cercado. */
export function loboNaSaida() {
  const d = dungeon,
    e = etapa(),
    naMissao = e === "a3_carregar" || e === "a3_lobo",
    // v7.7 (passo 5b): fora da missão, depois que o Caçador já tem o cercado, o lobo laçado é seu
    doJogador = !naMissao && campanha().feitas.a3_cercado != null;
  if ((!naMissao && !doJogador) || !d.active || d.camp) return;
  const m = d.monsters.find((o) => o.alive && o.bound && o.bound.dom && ehLobo(o));
  if (!m) return;
  // v7.7: o mesmo bicho do campo (mantenedor, 2026-10-18): sexo, pelagem e a ficha vão junto para o cercado
  const sexo: "M" | "F" = m.sex === "F" || m.sex === "M" ? m.sex : Math.random() < 0.5 ? "M" : "F"; // lobo de antes do sexo no nascimento
  ensureFol(m);
  const L: LoboCercado = {
    sexo,
    pelagem: m.coat || 0,
    ficha: {
      id: world.tick.toString(36) + "-" + Math.floor(Math.random() * 36 ** 4).toString(36),
      escala: m.big || 0.95,
      hpMax: m.hpMax,
      folMax: m.folMax!,
      spd: m.spd || 0,
    },
    vinculo: 0,
    dono: naMissao ? "cacador" : "jogador",
    desde: world.tick,
  };
  if (d.hero) L.comHeroi = d.hero.id; // v7.7: ela o leva pelo mapa; entra no cercado quando ela chega (cercado.ts)
  (econ.lobos ||= []).push(L);
  LB.m = null;
  m.alive = false; // sai com você (não fica para trás no campo)
  if (naMissao)
    campanhaEvento("loboCarregado"); // ainda caído (a3_lobo): o evento mais adiante conclui as duas
  else pushEvent("🐺 " + (sexo === "M" ? "Um lobo" : "Uma loba") + " é seu agora · leve ao cercado e cuide dele");
}

/** O Caçador lamenta o lobo abatido: a lição do abate limpo (pele melhor) ficou vista. */
function lamentar() {
  const d = dungeon;
  campanha().flags.abateLimpo = true;
  setBanner("🏹 O Caçador", FALAS_CURTAS.loboAbatido, LOBO_T.banner);
  // a horda também usa o letreiro: a frase sobe sobre ela também
  spawnDungeonToast(FALAS_CURTAS.loboAbatido, d.px, d.py - 84, "#ffe08a", 12);
}

/** Confere de tempos em tempos (iniciarCampanha). Caído (a3_lobo): finalizado → o Caçador lamenta; solto ou fugiu →
    esquece. Carregando: o lobo morreu (o Caçador precisava dele vivo) ou escapou da corda (ou você saiu do campo
    sem ele) → a missão volta a "lace um lobo". */
export function loboConferir() {
  const d = dungeon,
    m = LB.m,
    campo = d.active && !d.camp;
  if (etapa() === "a3_lobo") {
    if (!m || (campo && m.alive && m.bound)) return;
    LB.m = null;
    if (campo && !m.alive) lamentar();
    return;
  }
  if (etapa() !== "a3_carregar") return;
  if (campo && m && m.alive && m.bound) return;
  LB.m = null;
  campanhaIr("a3_lobo");
  if (!campo) return;
  if (m && !m.alive) {
    lamentar();
    return;
  }
  setBanner("🪢 Escapou", FALAS_CURTAS.loboFugiu, LOBO_T.banner);
  spawnDungeonToast(FALAS_CURTAS.loboFugiu, d.px, d.py - 84, "#ffe08a", 12);
}

/** Um bicho te machucou (hurtPlayer): a primeira mordida de lobo da missão rasga a roupa do peito. */
export function mordidaCampanha(m: Monster) {
  const e = etapa(),
    C = campanha();
  if ((e !== "a3_lobo" && e !== "a3_carregar") || C.flags.roupaRasgou || !m || !ehLobo(m)) return;
  const d = dungeon,
    it = d.hero && ensureEquip(d.hero).peito;
  if (!it) return;
  C.flags.roupaRasgou = true;
  eqDurInit(it);
  eqWear("peito", it.dur! + 1); // zera: quebra (eqBreak avisa e tira do corpo)
  spawnDungeonToast("🧵 " + FALAS_CURTAS.roupaRasgou, d.px, d.py - 70, "#ffb37a", 14);
}
