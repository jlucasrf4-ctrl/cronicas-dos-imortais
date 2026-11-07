/* ==== Fase 4 — código de carga do antigo src/js/modulos/v6.1_cena_inicial.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarCenaInicial() na ordem do antigo manifesto. */
import { dungeon, econ, world } from "../../core/state.ts";
import { WPN, WPN_OF, WPN_TXT } from "../../data/combate.ts";
import { EQ_BASE } from "../../data/equipamento.ts";
import { ITEM_DEFS } from "../../data/itens.ts";
import { updateEcon } from "../../econ/economia.ts";
import { resCount, resSpend } from "../../expedicao/preparo.ts";
import { sfx } from "../../field/chao.ts";
import { forgeLearn } from "../../forja/forja.ts";
import { gainSkill } from "../../hero/nivel.ts";
import {
  ISC,
  arrowCraftRender,
  dlgAdvance,
  faquinhaNoCinto,
  introGo,
  introOutro,
  introStart,
  introTalk2,
  itemCnt,
  itemTakeH,
  knifeAnalyzeRender,
  say,
} from "../../intro/cena.ts";
import { GS_CODES } from "../../ui/gameshark.ts";

export function iniciarCenaInicial() {
  /* ==== v6.1 — cena inicial jogável: javali, o Caçador, flechas, Runa Natural, joias nos monstros, Faca Velha, acampamento e análise ==== */
  /* --- faca como arma de mão --- */
  WPN.faca = { mult: 0.72, cd: 0.62, reach: 0.62, half: 0.38, kb: 0.4, lunge: 0.7, thrust: true, bleed: 0.25 };
  Object.assign(ITEM_DEFS, {
    eq_faca_velha: {
      key: "eq_faca_velha",
      name: "Faca Velha",
      emoji: "🔪",
      color: "#8f8a80",
      slot: "maoD",
      dmg: 0.8,
      val: 4,
      w: 0,
      desc: "Presente do Caçador para novatos. Lâmina gasta, cabo de madeira amarrado com couro. Rápida e curta; sangra. Analise para entender como foi feita.",
    },
    eq_faca: {
      key: "eq_faca",
      name: "Faca de Caça",
      emoji: "🔪",
      color: "#b8bcc4",
      slot: "maoD",
      dmg: 0.95,
      val: 10,
      w: 0.4,
      desc: "Faca forjada: estocadas rápidas e curtas, sangramento e ótima para finalizar.",
    },
    /* v7.7 — faca simples: lasca de pedra num cabo, feita na carpintaria; barata e quebra rápido (no cinto, finaliza) */
    eq_faca_simples: {
      key: "eq_faca_simples",
      name: "Faca Simples",
      emoji: "🔪",
      color: "#9a8f80",
      slot: "maoD",
      dmg: 0.7,
      val: 3,
      w: 0.2,
      desc: "Uma lasca de pedra amarrada num cabo de madeira. Barata e frágil: quebra depois de poucos usos. No cinto, finaliza bichos caídos (E).",
    },
  });
  for (const k of ["eq_faca_velha", "eq_faca", "eq_faca_simples"])
    ITEM_DEFS[k].shape = [".#.", ".#.", ".#.", "###", ".#.", ".#."].map((r) =>
      Array.from(r, (ch) => (ch === "#" ? 1 : 0)),
    );
  WPN_OF.eq_faca_velha = "faca";
  WPN_OF.eq_faca = "faca";
  WPN_OF.eq_faca_simples = "faca";
  // v7.7: a Faca de Caça leva um cabo esculpido (não galho cru); a Faca Velha é o presente do tutorial e a Simples sai da
  // carpintaria: nenhuma das duas se forja (docs/materiais.md)
  EQ_BASE.eq_faca = { dur: 80, mat: { ferro: 1, cabo: 1 }, kind: "metal" };
  EQ_BASE.eq_faca_velha = { dur: 50, mat: { ferro: 1, cabo: 1 }, kind: "metal", forja: false };
  EQ_BASE.eq_faca_simples = { dur: 20, mat: { pedra: 1, cabo: 1 }, kind: "madeira", forja: false };
  try {
    WPN_TXT.faca = "Curta e rápida · estocadas · sangramento · finaliza bichos laçados ou desmaiados";
  } catch (_) {}
  /* --- fazer flechas com o Caçador (prático: lascar → encaixar → amarrar) --- */
  document.addEventListener(
    "click",
    (e) => {
      const b = ((e.target as HTMLElement).closest &&
        (e.target as HTMLElement).closest("#isc-craft [data-ic]")) as HTMLButtonElement;
      if (!b || b.disabled) return;
      e.stopPropagation();
      const A = ISC.ac,
        h = dungeon.hero;
      if (!A) return;
      if (b.dataset.ic === "ok") {
        document.getElementById("isc-craft")!.classList.remove("on");
        dungeon.modalOpen = false;
        introGo("talk");
        introTalk2();
        return;
      }
      const i = +b.dataset.ic!;
      if (i !== A.step) return;
      sfx(i === 0 ? "hitlite" : "swing");
      A.step++;
      if (A.step >= 3) {
        const p = resCount(h!, "feather") > 0;
        itemTakeH(h!, "galho", 1);
        resSpend(h!, "stone", 1);
        if (p) resSpend(h!, "feather", 1);
        const n = p ? 3 : 2;
        econ.quiver.n += n;
        A.made += n;
        A.step = 0;
        sfx("perfect");
        gainSkill(h!, "arco", 2);
        updateEcon();
        arrowCraftRender(
          "✨ +" +
            n +
            " flechas! " +
            (itemCnt(h!, "galho") && resCount(h!, "stone") ? "Dá para fazer mais." : "Acabaram os materiais."),
        );
        return;
      }
      arrowCraftRender(["", "A ponta está lascada. Agora encaixe na haste.", "Firme. Falta amarrar."][A.step]);
    },
    true,
  );
  /* --- ANALISAR a faca --- */
  document.addEventListener(
    "click",
    (e) => {
      const b = ((e.target as HTMLElement).closest &&
        (e.target as HTMLElement).closest("#isc-ana [data-ia]")) as HTMLElement;
      if (!b) return;
      e.stopPropagation();
      const h = dungeon.hero;
      if (b.dataset.ia === "look") {
        ISC.ana!++;
        sfx("ping");
        gainSkill(h!, "percepcao", 2);
        knifeAnalyzeRender();
        return;
      }
      if (b.dataset.ia === "learn") {
        forgeLearn("eq_faca");
        econ.weaponLore = true;
        gainSkill(h!, "percepcao", 8);
        sfx("perfect");
        document.getElementById("isc-ana")!.classList.remove("on");
        dungeon.modalOpen = false;
        faquinhaNoCinto(); // v7.7: no cinto ela finaliza com E (items/cinto.ts)
        say(
          [
            [
              "Viu só? Agora você sabe do que uma faca é feita.",
              "Com ferro e um cabo esculpido na carpintaria, dá pra forjar uma na bigorna do acampamento.",
            ],
            ["Prende essa no cinto.", "Assim ela fica à mão: bicho caído ou laçado, você termina o serviço (E)."],
            [
              "Toda arma que você encontrar pode te ensinar alguma coisa.",
              "Vou indo na frente com o javali. Te vejo no acampamento.",
            ],
          ],
          () => introOutro(),
        );
      }
    },
    true,
  );
  /* --- interface: cinema, objetivo, caixa de diálogo --- */
  window.addEventListener(
    "keydown",
    (e) => {
      if (!ISC.dlg) return;
      if (e.code === "Space" || e.code === "KeyE" || e.code === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) dlgAdvance();
      }
    },
    true,
  );
  GS_CODES.INTRO = () => {
    const h = world.heroes.find((x) => x.state === "idle");
    if (!h) return "Precisa de um personagem no acampamento.";
    econ.introDone = false;
    econ._introKeep = 1;
    setTimeout(() => introStart(h), 300);
    return "Rodando a cena inicial com " + h.name + " (espada e escudo vão para o baú)";
  };
}
