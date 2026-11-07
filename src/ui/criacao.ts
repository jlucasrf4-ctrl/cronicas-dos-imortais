/* ==== Fase 4 — criação do personagem: nome, nascimento e o cenário em 3D (base/02, v6.4) ==== */
import { randomHeroName } from "../expedicao/preparo.ts";
import { JANELAS, econ, world } from "../core/state.ts";
import { costText, creationCost, canPay, payCost } from "../econ/economia.ts";
import { updateHeroPanelUI } from "./painel.ts";
import { ISC, introStart } from "../intro/cena.ts";
import { bornFromSeed } from "../hero/nascimento.ts";
import { newSeed } from "../core/rng.ts";
import { createHero } from "../hero/nivel.ts";
import { ensureEquip } from "../items/equipamento.ts";
import { AFFINITIES, GENETICS } from "../data/nascimento.ts";
import { esc } from "../core/util.ts";
import { sfx } from "../field/chao.ts";
import { PALCO, PORT, glPortrait, glRetratoCriacao, palcoAlternar, palcoIr } from "../render/retrato.ts";
import { ACOES_CRIACAO } from "../data/retrato.ts";
import { attrBarsHtml } from "./ficha.ts";
import type { Hero } from "../core/tipos.ts";

/* ---------- criação: você só dá o nome; o resto nasce ---------- */
export function randomizeCreate() {
  (document.getElementById("create-name") as HTMLInputElement).value = randomHeroName();
  refreshCreateUI();
}
export function refreshCreateUI() {
  const b = document.getElementById("create-confirm") as HTMLButtonElement;
  if (!b) return;
  b.disabled = !(document.getElementById("create-name") as HTMLInputElement).value.trim();
  b.title = b.disabled ? "Dê um nome ao personagem (ou 🎲 Nome)" : ""; // v7.7: diz por que está indisponível
}
export function openCreateModal() {
  JANELAS._crTimers.forEach(clearTimeout);
  JANELAS._crTimers = [];
  // v7.7: abre com um nome sorteado (dá para trocar): o "Fazer nascer" já começa disponível, não apagado
  (document.getElementById("create-name") as HTMLInputElement).value = randomHeroName();
  document.getElementById("cr-step1")!.style.display = "";
  document.getElementById("cr-reveal")!.style.display = "none";
  document.getElementById("cr-reveal")!.innerHTML = "";
  refreshCreateUI();
  document.getElementById("create-cost")!.textContent = "Custo: " + costText(creationCost());
  document.getElementById("create-modal")!.classList.add("open");
  /* v6.4; v8.0: o palco começa no mistério (ninguém nasceu ainda) */
  document.getElementById("create-modal")!.classList.add("scene");
  document.getElementById("create-card")!.classList.add("misterio");
}
export function closeCreateModal() {
  JANELAS._crTimers.forEach(clearTimeout);
  JANELAS._crTimers = [];
  document.getElementById("create-modal")!.classList.remove("open");
  updateHeroPanelUI();
  /* v6.1 */
  {
    const h = ISC.cand;
    ISC.cand = null;
    if (h && !econ.introDone && world.heroes.length === 1) setTimeout(() => introStart(h), 450);
  }
}
export function confirmCreateHero() {
  const name = (document.getElementById("create-name") as HTMLInputElement).value.trim();
  if (!name) return;
  const cost = creationCost();
  if (!canPay(cost)) {
    document.getElementById("create-cost")!.textContent = "Faltam recursos. Custo: " + costText(cost);
    return;
  }
  payCost(cost);
  const h = createHero(name, bornFromSeed(newSeed())); // a semente nasce AGORA, sem prévia: não dá pra escolher
  ensureEquip(h); // o retrato de nascimento já mostra o equipamento inicial que ela usará no campo
  updateHeroPanelUI();
  playBirth(h);
}
export function playBirth(h: Hero) {
  /* v6.1 */
  ISC.cand = h;
  const A = AFFINITIES[h.aff],
    G = GENETICS[h.gen],
    box = document.getElementById("cr-reveal")!,
    card = document.getElementById("create-card")!;
  document.getElementById("cr-step1")!.style.display = "none";
  box.style.display = "";
  box.innerHTML = "";
  card.style.setProperty("--aff", A.color);
  const steps = [
    ["NASCIMENTO", "Um novo indivíduo surgiu.", '<div class="cr-big">' + esc(h.name) + "</div>"],
    [
      "AFINIDADE",
      "Uma afinidade foi despertada.",
      '<div class="cr-big" style="color:' +
        (A.ink || A.color) +
        ";text-shadow:0 0 10px " +
        A.color +
        '">' +
        A.icon +
        " " +
        A.name +
        "</div><div>Seu personagem nasceu com afinidade: <b>" +
        A.icon +
        " " +
        A.name +
        ".</b></div><i>" +
        A.birth +
        "</i>",
    ],
    [
      "GENÉTICA",
      "Seu corpo manifesta uma predisposição incomum.",
      '<div class="cr-big" style="font-size:1.05rem">' + G.name + "</div><i>" + G.desc + "</i>",
    ],
    ["ATRIBUTOS", "Estas são suas características naturais.", '<div class="sh-attrs">' + attrBarsHtml(h) + "</div>"],
    [
      "PERSONAGEM",
      "Agora você conhece quem nasceu.",
      "<i>Nada está decidido. Proficiências, caminhos e sinergias surgem do que " + esc(h.name) + " viver.</i>",
    ],
  ];
  steps.forEach((s, i) => {
    const el = document.createElement("div");
    el.className = "cr-step";
    el.innerHTML = '<div class="cr-tag">' + s[0] + '</div><div class="cr-line">' + s[1] + "</div>" + s[2];
    box.appendChild(el);
    JANELAS._crTimers.push(
      setTimeout(
        () => {
          el.classList.add("show");
          sfx(i === 4 ? "perfect" : "ping");
          if (i === steps.length - 1) fin.classList.add("show");
        },
        500 + i * 1500,
      ),
    );
  });
  const fin = document.createElement("div");
  fin.className = "cr-step cr-fin";
  fin.innerHTML =
    '<button class="btn" id="cr-skip" style="background:#6b4a1f;border-color:var(--gold-bright);color:#fff8e3">Conhecer ' +
    esc(h.name) +
    "</button>";
  box.appendChild(fin);
  fin.querySelector("button")!.addEventListener("click", () => {
    closeCreateModal();
  });
  /* v6.1.1 */
  try {
    const box = document.getElementById("cr-reveal"),
      card = document.getElementById("create-card");
    if (card && !card._fast) {
      card._fast = 1;
      card.addEventListener("pointerdown", (e) => {
        const bx = document.getElementById("cr-reveal");
        if (
          !bx ||
          bx.style.display === "none" ||
          ((e.target as HTMLElement).closest && (e.target as HTMLElement).closest("button"))
        )
          return;
        const steps = bx.querySelectorAll(".cr-step");
        const hidden = [...steps].filter((s) => !s.classList.contains("show"));
        if (!hidden.length) return;
        hidden[0].classList.add("show");
        sfx("ping");
        if (hidden.length === 1 || (hidden.length === 2 && hidden[1].classList.contains("cr-fin"))) {
          JANELAS._crTimers.forEach(clearTimeout);
          JANELAS._crTimers = [];
          steps.forEach((s) => s.classList.add("show"));
        }
      });
    }
    if (box && !box.querySelector(".cr-tapfast")) {
      const tip = document.createElement("div");
      tip.className = "cr-tapfast";
      tip.textContent = "toque para acelerar";
      box.prepend(tip);
    }
  } catch (_) {}
  /* v6.4; v8.0: no palco, o personagem sorteado (corpo + cabeça) animado, parado e sem armas; sem os dados, o
     retrato antigo; sem WebGL, o palco fica no mistério */
  try {
    const cv = document.getElementById("cr-port") as HTMLCanvasElement;
    card.classList.remove("misterio");
    CRIA.h = h;
    // v8.1: abre no close do rosto e do busto; clicar mostra o corpo inteiro com a demonstração (render/retrato.ts)
    palcoIr(false, 0);
    PALCO.cam = null; // a câmera começa já no close
    arrastarPalco(cv);
    marcasPalco();
    cancelAnimationFrame(CRIA.raf);
    const loop = (now: number) => {
      if (!document.getElementById("create-modal")!.classList.contains("open") || CRIA.h !== h) {
        CRIA.raf = 0;
        return;
      }
      if (!glRetratoCriacao(h, cv) && !glPortrait(h, cv, now / 1000)) {
        card.classList.add("misterio");
        return;
      }
      CRIA.raf = requestAnimationFrame(loop);
    };
    CRIA.raf = requestAnimationFrame(loop);
  } catch (_) {}
}

/* ---------- CRIAÇÃO: cenário próprio em tela cheia e o personagem em 3D ---------- */
const CRIA = { raf: 0, h: null as Hero | null, arrasto: false };
/** Arrastar no palco gira o personagem; v8.1: um clique (sem arrastar) alterna o close e o corpo inteiro. */
function arrastarPalco(cv: HTMLCanvasElement) {
  if (CRIA.arrasto) return;
  CRIA.arrasto = true;
  cv.addEventListener("pointerdown", (e) => {
    e.stopPropagation(); // o toque no cartão acelera a revelação; no palco, só gira
    cv.setPointerCapture(e.pointerId);
    PORT.drag = { x: e.clientX, y0: PORT.yaw };
  });
  cv.addEventListener("pointermove", (e) => {
    if (PORT.drag) PORT.yaw = PORT.drag.y0 - (e.clientX - PORT.drag.x) * 0.012;
  });
  cv.addEventListener("pointerup", (e) => {
    const clique = PORT.drag && Math.abs(e.clientX - PORT.drag.x) < 6;
    PORT.drag = null;
    if (clique) {
      palcoAlternar();
      marcasPalco();
    }
  });
  cv.addEventListener("pointercancel", () => (PORT.drag = null));
}
/** v8.1 — o aviso embaixo do palco e as marquinhas das ações (só com o corpo inteiro: clicar pula para aquela). */
function marcasPalco() {
  const palco = document.getElementById("cr-palco"),
    aviso = document.getElementById("cr-arrastar");
  if (!palco || !aviso) return;
  aviso.textContent = PALCO.inteira ? "clique para voltar ao rosto · arraste para girar" : "clique para ver inteira";
  let el = document.getElementById("cr-acoes");
  if (!el) {
    el = document.createElement("div");
    el.id = "cr-acoes";
    el.innerHTML = ACOES_CRIACAO.map(
      (a, i) => `<button type="button" data-i="${i}" title="${a.nome}">${a.ico}</button>`,
    ).join("");
    el.addEventListener("pointerdown", (e) => e.stopPropagation());
    el.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-i]");
      if (!b) return;
      palcoIr(true, Number(b.dataset.i));
      marcasPalco();
    });
    palco.appendChild(el);
  }
  el.classList.toggle("on", PALCO.inteira);
}
