/* ==== v7.7 — dormir na barraca (campanha C1, docs/campanha.md): Z perto da tenda, à noite, pula até o amanhecer ====
   A tela escurece (#sono), o mundo simula o tempo pulado pelo avanço rápido de sempre (world.fastForwardTarget, o mesmo
   do +1h/+1d), e ao acordar: vida e fôlego cheios, ferimentos tratados (menos com fome), o frio some, a fome sobe pelas
   horas dormidas e o Caçador acorda. Avisa a campanha com o evento "dormiu". A tecla está em iniciarCampanha.
   Também o aviso de voltar antes da noite (avisoNoite, chamado por iniciarCampanha): longe do acampamento (no campo,
   ou a primeira heroína longe da base no mapa), uma vez por noite às 17h ("escurecendo") e às 19h30 ("anoiteceu"). */
import { dungeon, econ, world } from "../core/state.ts";
import { CONFIG } from "../core/config.ts";
import { fmtClock } from "../core/util.ts";
import { campNear } from "../survival/acampamento.ts";
import { hpCap } from "../survival/sobrevivencia.ts";
import { setBanner, spawnDungeonToast } from "../field/masmorra.ts";
import { mvToast } from "../ui/avisos.ts";
import { pushEvent } from "../sim/eventos.ts";
import { ctAtivo } from "../intro/tutorial.ts";
import { campanhaEvento, campanhaEventoAtual } from "./campanha.ts";

/** Horários em minutos do dia; o resto por hora dormida. */
const SONO = {
  deitar: 19.5 * 60, // a partir de quando é noite (o mesmo do sol/lua do HUD)
  acordar: 6 * 60, // até quando é noite / a hora de acordar
  fomeHora: 2, // a fome sobe isso por hora dormida (10 h ≈ +20)
  feridaHora: 10, // ferimentos tratados por hora (como o descanso no acampamento do mapa)
  feridaHoraFome: 3.3, // …com fome acima de 60
  escuro: 700, // ms do escurecer/clarear da tela
  aviso: 17 * 60, // "está escurecendo": volte antes da noite (a 1×, 17h → 19h30 ≈ 40 s)
  longe: 30, // no mapa: a heroína a mais que isso da base conta como fora do acampamento
  banner: 4, // s do aviso no campo
};

const S = { on: false, h0: 0, fome0: 0, el: null as HTMLElement | null };

function minutoDoDia() {
  return world.tick % CONFIG.DAY_MIN;
}
export function ehNoite() {
  const t = minutoDoDia();
  return t >= SONO.deitar || t < SONO.acordar;
}

/* ---------- aviso de voltar antes da noite ---------- */
const AV = { noite: null as number | null, fase: 0 };

/** Longe do acampamento: numa expedição (não no acampamento, no treino ou na introdução) ou, no mapa, a primeira
    heroína longe da base. */
function foraDoAcampamento() {
  const d = dungeon;
  if (d.active) return !d.camp && !d.training && d.mode !== "intro" && !d.dead;
  const h = world.heroes[0];
  return !!(h && h.camp && Math.hypot(h.x - h.camp.x, h.y - h.camp.y) > SONO.longe);
}

/** Confere a hora (iniciarCampanha chama algumas vezes por segundo) e avisa uma vez por fase em cada noite. */
export function avisoNoite() {
  if (econ.campTut !== 3 || S.on) return; // depois do tutorial do acampamento
  const t = minutoDoDia(),
    noite = Math.floor((world.tick - SONO.acordar) / CONFIG.DAY_MIN), // a noite vai das 6h às 6h do dia seguinte
    fase = ehNoite() ? 2 : t >= SONO.aviso ? 1 : 0;
  if (AV.noite !== noite) {
    // a primeira leitura (jogo carregado já de tarde) não avisa o que já passou
    const primeira = AV.noite === null;
    AV.noite = noite;
    AV.fase = primeira ? fase : 0;
  }
  if (fase <= AV.fase) return;
  AV.fase = fase;
  if (!foraDoAcampamento()) return;
  const tit = fase === 2 ? "🌙 Anoiteceu" : "🌇 Está escurecendo",
    sub = fase === 2 ? "Volte ao acampamento e durma na barraca" : "Volte ao acampamento antes da noite";
  if (dungeon.active) setBanner(tit, sub, SONO.banner, fase === 2 ? "#a9c4ff" : "#ffb86b");
  else {
    mvToast(tit + " · " + sub.toLowerCase());
    pushEvent(tit + " — " + (world.heroes[0]?.name || "a heroína") + " está longe do acampamento");
  }
}

/** Está perto da tenda montada, no acampamento, fora do tutorial: dá para tentar dormir. */
export function pertoDaCama() {
  const d = dungeon;
  return !!(d.active && d.camp && !d.dead && econ.tent && !ctAtivo() && campNear() === "tenda");
}

function tela() {
  if (!S.el) {
    S.el = document.createElement("div");
    S.el.id = "sono";
    S.el.innerHTML = "<b>💤</b><span></span>";
    document.getElementById("dungeon-view")!.appendChild(S.el);
  }
  return S.el;
}

/** Z perto da tenda. */
export function dormir() {
  const d = dungeon;
  if (S.on || !pertoDaCama() || d.modalOpen || d.invOpen) return;
  if (!ehNoite()) {
    spawnDungeonToast(
      "Ainda é dia · dá para dormir depois das " + fmtClock(SONO.deitar),
      d.px,
      d.py - 40,
      "#ffe08a",
      12,
    );
    return;
  }
  const h = d.hero!;
  S.on = true;
  S.fome0 = h.hunger || 0; // o herói "no campo" perde fome no passo do mapa; a conta certa é feita ao acordar
  d.modalOpen = true;
  d.charging = false;
  d.guard = false;
  d.keys = {};
  const el = tela();
  el.classList.add("on");
  setTimeout(() => {
    // o relógio andou durante o escurecer: conta as horas a partir de agora
    const min = (SONO.acordar - minutoDoDia() + CONFIG.DAY_MIN) % CONFIG.DAY_MIN;
    S.h0 = min / 60;
    world.fastForwardTarget += min;
    esperar();
  }, SONO.escuro);
}

function esperar() {
  const el = tela();
  el.querySelector("span")!.textContent = fmtClock(world.tick);
  if (world.fastForwardTarget > 0 && dungeon.active) {
    setTimeout(esperar, 100);
    return;
  }
  acordar();
}

function acordar() {
  const d = dungeon,
    h = d.hero,
    horas = S.h0;
  if (d.active && h) {
    h.hunger = Math.min(100, S.fome0 + SONO.fomeHora * horas);
    h.cold = 0;
    h.energy = 100;
    d.wound = Math.max(0, (d.wound || 0) - horas * (h.hunger > 60 ? SONO.feridaHoraFome : SONO.feridaHora));
    d.hp = hpCap();
    d.gstam = 100;
    d.gint = 100;
    d.runLock = false;
    econ.hunterNap = false; // de manhã o Caçador já levantou
    spawnDungeonToast(
      "☀ Amanheceu · Dia " + (Math.floor(world.tick / CONFIG.DAY_MIN) + 1),
      d.px,
      d.py - 44,
      "#ffe08a",
      14,
    );
    campanhaEvento("dormiu");
    campanhaEventoAtual("noiteCria"); // v8.0: a noite do fim do Ato 3 (só se for a missão atual)
  }
  tela().classList.remove("on");
  setTimeout(() => {
    S.on = false;
    dungeon.modalOpen = false;
  }, SONO.escuro);
}
