/* Janelinhas independentes para cada proficiência ou maestria usada recentemente. */
import { PROF_BY } from "../data/atributos.ts";

interface ProgressoAtual {
  chave: string;
  nome: string;
  icone: string;
  nivel: number;
  atual: number;
  necessario: number;
  unidade: string;
  ultimaAcao: number;
  fixo: boolean;
}

const HUD = new Map<string, ProgressoAtual>();
const PISCA_APOS = 20 * 1000;
const FECHA_APOS = 22 * 1000;
let pronto = false;
let timerFechar: number | null = null;

function desenhar() {
  if (typeof document === "undefined") return;
  const container = document.getElementById("weapon-progress-hud");
  if (!container) return;

  if (!pronto) {
    container.addEventListener("click", (event) => {
      const alvo = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-acao][data-chave]");
      if (!alvo) return;
      const item = HUD.get(alvo.dataset.chave || "");
      if (!item) return;
      if (alvo.dataset.acao === "fechar") HUD.delete(item.chave);
      else if (alvo.dataset.acao === "fixar") item.fixo = !item.fixo;
      agendarFechamento();
      desenhar();
    });
    pronto = true;
  }

  const agora = Date.now();
  for (const [chave, item] of HUD) {
    if (!item.fixo && agora - item.ultimaAcao >= FECHA_APOS) HUD.delete(chave);
  }
  container.replaceChildren();
  for (const item of HUD.values()) {
    const card = document.createElement("section");
    card.className = "wph-card";
    if (!item.fixo && agora - item.ultimaAcao >= PISCA_APOS) card.classList.add("wph-piscando");
    card.innerHTML =
      '<div class="wph-head"><b><span class="wph-icon"></span> <span class="wph-name"></span> Nv.<span class="wph-lvl"></span></b>' +
      '<button class="wph-pin" data-acao="fixar" title="Fixar progresso"></button>' +
      '<button class="win-x" data-acao="fechar" title="Fechar progresso">×</button></div>' +
      '<div class="bb"><i class="wph-fill"></i></div><div class="wph-pts"></div>';
    card.dataset.chave = item.chave;
    for (const button of card.querySelectorAll<HTMLButtonElement>("button[data-acao]"))
      button.dataset.chave = item.chave;
    card.querySelector<HTMLElement>(".wph-icon")!.textContent = item.icone;
    card.querySelector<HTMLElement>(".wph-name")!.textContent = item.nome;
    card.querySelector<HTMLElement>(".wph-lvl")!.textContent = String(item.nivel);
    card.querySelector<HTMLElement>(".wph-pts")!.textContent =
      item.necessario > 0 ? Math.floor(item.atual) + " / " + item.necessario + " " + item.unidade : "Nível máximo";
    card.querySelector<HTMLElement>(".wph-fill")!.style.width =
      Math.min(100, item.necessario > 0 ? (item.atual / item.necessario) * 100 : 100) + "%";
    const pin = card.querySelector<HTMLButtonElement>(".wph-pin")!;
    pin.textContent = item.fixo ? "📌" : "📍";
    pin.title = item.fixo ? "Desafixar progresso" : "Fixar progresso";
    container.append(card);
  }
  container.style.display = HUD.size ? "flex" : "none";
}

function agendarFechamento() {
  if (typeof window === "undefined") return;
  if (timerFechar != null) window.clearTimeout(timerFechar);
  timerFechar = null;
  const expiracoes = [...HUD.values()]
    .filter((item) => !item.fixo)
    .map((item) => item.ultimaAcao + (Date.now() - item.ultimaAcao < PISCA_APOS ? PISCA_APOS : FECHA_APOS));
  if (!expiracoes.length) return;
  timerFechar = window.setTimeout(
    () => {
      timerFechar = null;
      desenhar();
      agendarFechamento();
    },
    Math.max(0, Math.min(...expiracoes) - Date.now()),
  );
}

/** Atualiza a janelinha dessa atividade sem apagar as outras que ainda estão abertas. */
export function progressoEfetivo(id: string, nivel: number, atual: number, necessario: number, unidade = "XP") {
  const info = PROF_BY[id] || { n: id, i: "✦" },
    chave = id,
    anterior = HUD.get(chave);
  HUD.set(chave, {
    chave,
    nome: info.n,
    icone: info.i,
    nivel,
    atual,
    necessario,
    unidade,
    ultimaAcao: Date.now(),
    fixo: anterior?.fixo || false,
  });
  agendarFechamento();
  desenhar();
}

/** Remove janelinhas expiradas, inclusive quando a aba suspendeu os temporizadores. */
export function progressoHudTick() {
  if (typeof document === "undefined" || !HUD.size) return;
  const agora = Date.now();
  let mudou = false;
  for (const [chave, item] of HUD) {
    if (!item.fixo && agora - item.ultimaAcao >= FECHA_APOS) {
      HUD.delete(chave);
      mudou = true;
    }
  }
  if (mudou) {
    desenhar();
    agendarFechamento();
  }
}
