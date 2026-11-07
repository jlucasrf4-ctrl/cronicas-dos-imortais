/* ==== Fase 4 — código de carga do antigo src/js/modulos/v5.8_correcoes.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarCorrecoes() na ordem do antigo manifesto. */
import { OPT, dungeon, world } from "../../core/state.ts";
import { ALL_KEYS, SPECIES, SP_UI, WILD_CAP } from "../../data/especies.ts";
import { COATS } from "../../data/genetica.ts";
import { TOAST_ICONS } from "../../data/icones.ts";
import { HUNT_TARGETS } from "../../data/recursos.ts";
import { fireArrow } from "../../field/acertos.ts";
import { CAMF, camFocus } from "../../map/camera.ts";
import { SPR } from "../../render/sprites.ts";
import { WORLD_SAVE_KEYS } from "../../save/salvar.ts";
import { IMMIGRATION, boarSeed } from "../../sim/fauna.ts";
import { MOB } from "../../ui/celular.ts";

export function iniciarCorrecoes() {
  /* =====================================================================
     v5.8 — CORREÇÕES
     · Ficha (K) na masmorra ficava escondida atrás da tela da masmorra (o jogo parecia travado).
     · Mochila na masmorra: faixa "Equipado" — clique tira o item para a mochila,
       clique direito larga no chão; arrastar item da mochila para o espaço equipa.
     · Item largado no chão guarda qualidade, durabilidade e atributos.
     · Modo teste ("tudo grátis") também dispensa materiais da forja, Folhama e substratos das runas,
       e libera todas as receitas.
  ===================================================================== */
  setTimeout(() => {
    const m = document.getElementById("sheet-modal");
    if (m && m.parentNode !== document.body) document.body.appendChild(m);
  }, 0);
  // arco: soltar o botão esquerdo dispara (no PC; no celular o botão de ataque já faz isso)
  window.addEventListener("pointerup", (e) => {
    if (
      e.button === 2 &&
      dungeon.active &&
      dungeon.weapon === "bow" &&
      dungeon.charging &&
      !(typeof MOB !== "undefined" && MOB.on && e.pointerType === "touch")
    )
      fireArrow();
  });

  /* ---- JAVALI na fauna do mapa ---- */
  SPECIES.boar = Object.assign({}, SPECIES.deer, {
    key: "boar",
    label: "Javali",
    diet: "herbivore",
    color: "#8a5a3a",
    radius: 5.4,
    speedWalk: 2.4,
    speedFlee: 10.5,
    visionRange: 100,
    dangerRange: 55,
    hungerRate: 0.026,
    thirstRate: 0.036,
    matureAgeDay: 3,
    maxAgeDay: 18,
    reproCooldownDay: 2.2,
    litterSize: [2, 4],
    carryingCapacity: 16,
    predators: ["wolf"],
    fleeFrom: ["wolf"],
    meatValue: 70,
  });
  if (SPECIES.wolf.preySpecies.indexOf("boar") < 0) SPECIES.wolf.preySpecies.push("boar");
  COATS.boar = {
    label: "Javali",
    v: [
      ["Pardo", "cerdas castanho-escuras, o mais comum da mata", 4],
      ["Negro", "cerdas pretas e grossas, presas bem brancas", 2],
      ["Malhado", "listras claras de filhote que nunca sumiram", 1],
    ],
  };
  IMMIGRATION.boar = {
    low: 3,
    group: [2, 4],
    pZero: 0.06,
    pLow: 0.02,
    msg: "🐗 Uma vara de javalis apareceu na mata.",
  };
  SP_UI.boar = { label: "Javali", color: "#b07a4a" };
  if (ALL_KEYS.indexOf("boar") < 0) ALL_KEYS.push("boar");
  SPR.boar = [0, 3]; // desenhado pelo retrato pintado (ver drawSprite)
  setTimeout(function _bs() {
    try {
      if (world && world.animals && world.animals.length && !world._boarOk) {
        world._boarOk = 1;
        boarSeed();
      }
    } catch (_) {}
    setTimeout(_bs, 3000);
  }, 3000);
  HUNT_TARGETS.splice(2, 0, ["boar", "🐗 Javali (4–5 carne)"]);

  /* ---- JAVALI na masmorra: investida que derruba ----
     telegrafa (raspa o chão e mira) → dispara em linha reta. Esquivar (rolar/esquiva da lança) passa por ele;
     escudo de frente bloqueia (gasta muito fôlego); parry no tempo certo atordoa o javali.
     Se acertar: derruba o herói (1,1 s sem agir) e deixa TONTO por 5 s (anda 35% mais devagar e ataca mais devagar). */
  TOAST_ICONS.unshift([/^Derrubado!$/, "💫", "#ff9a6a"], [/^❗$/, "❗", "#ff9a6a"]);

  /* ---- MAPA: região ativa de 2×2 quadrantes; zoom alto só para olhar; câmera mostra para onde o herói foi ---- */
  for (const k of ["rabbit", "deer", "wolf", "boar"])
    if (SPECIES[k] && !SPECIES[k]._cap2) {
      SPECIES[k].carryingCapacity *= 2;
      SPECIES[k]._cap2 = 1;
    }
  for (const k in WILD_CAP) WILD_CAP[k] *= 2;
  setInterval(() => {
    if (typeof world === "undefined" || !world.heroes || dungeon.active || OPT.camFollow === false) return;
    for (const h of world.heroes) {
      const sig = h.state + "|" + (h.task ? Math.round(h.task.x) + "," + Math.round(h.task.y) : ""),
        prev = CAMF.last[h.id];
      CAMF.last[h.id] = sig;
      if (
        prev !== undefined &&
        prev !== sig &&
        (h.state === "traveling" || h.state === "hunting") &&
        h.task &&
        prev.split("|")[0] === "idle"
      )
        camFocus(h.task.x, h.task.y);
    }
  }, 250);
  setTimeout(() => {
    try {
      if (!WORLD_SAVE_KEYS.includes("qver")) WORLD_SAVE_KEYS.push("qver");
      if (world && world.qver == null && !(world.heroes || []).length) world.qver = 3;
    } catch (_) {}
  }, 0);
}
