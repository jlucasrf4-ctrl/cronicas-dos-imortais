/* ==== Fase 4 — gameshark: códigos de teste (v5.9.04) ==== */
import { CACA, GL3, econ, world } from "../core/state.ts";
import { VESTIDO, vestir } from "../render/gl/vestidos.ts";
import { treinoDeQualquerLugar } from "../field/treino.ts";
import { abrirModelosTeste } from "./modelos_teste.ts";
import { mnt, mountBag, coatOf, tamRollCoat, MP, mpRender } from "../creatures/tamandua.ts";
import { MOUNT, TCOATS } from "../data/sobrevivencia.ts";
import { pushEvent } from "../sim/eventos.ts";
import { updateEcon } from "../econ/economia.ts";
import { mvToast } from "./avisos.ts";
import { sfx } from "../field/chao.ts";
import { campanha, campanhaIr, campanhaPular, missaoAtual } from "../campanha/campanha.ts";
import { MISSAO_INICIAL } from "../data/campanha.ts";
import { gsLobos } from "../campanha/cercado.ts";
import { gsPedido } from "../campanha/pedidos.ts";
import { tryAddToInv } from "../field/chao.ts";
import { ensureInv } from "../items/inventario.ts";
import type { InvGrid } from "../core/tipos.ts";

/* ---------- 🎮 GAMESHARK (códigos de teste) ---------- */
export const GS = { buf: "", on: false };
export function tameCheatBtn() {
  return econ.test || GS.on ? " <button class='btn' data-ta='win'>⚡ Domar na hora (GameShark)</button>" : "";
}
function gsDeusa(nome: string) {
  const rotulo = vestir(nome);
  GL3.heroKey = "";
  return rotulo ? "Agora você é a " + rotulo : "De volta à heroína";
}
export const GS_CODES: Record<string, () => string> = {
  TAMANDUA: () => {
    if (mnt()) return "Você já tem " + mnt()!.name + ".";
    econ.mount = {
      name: MOUNT.names[Math.floor(Math.random() * MOUNT.names.length)],
      xp: 0,
      hp: 100,
      sta: 100,
      with: null,
      since: world.tick || 0,
      brushDay: -1,
      feedDay: -1,
      bag: null,
      coat: tamRollCoat(),
      dirt: 60,
    };
    mountBag();
    pushEvent("🎮 GameShark: " + mnt()!.name + " apareceu no acampamento, já domado.");
    return "Tamanduá " + mnt()!.name + " no acampamento!";
  },
  VINCULO: () => {
    if (!mnt()) return "Primeiro pegue um tamanduá (TAMANDUA).";
    mnt()!.xp = MOUNT.lvXp[3];
    mountBag();
    return "Vínculo máximo com " + mnt()!.name + "!";
  },
  CUPIM: () => {
    econ.cupim = (econ.cupim || 0) + 20;
    return "+20 cupins";
  },
  DOMAFACIL: () => {
    GS.on = !GS.on;
    return "Domar na hora: " + (GS.on ? "LIGADO" : "desligado");
  },
  OURO: () => {
    econ.gold = (econ.gold || 0) + 1000;
    updateEcon();
    return "+1000 💰";
  },
  PELAGEM: () => {
    const m = mnt();
    if (!m) return "Primeiro pegue um tamanduá (TAMANDUA).";
    const K = Object.keys(TCOATS);
    m.coat = K[(K.indexOf(coatOf(m)) + 1) % K.length];
    return m.name + " agora é " + TCOATS[m.coat].n;
  },
  SUJAR: () => {
    const m = mnt();
    if (!m) return "Nenhum tamanduá.";
    m.dirt = 100;
    return m.name + " rolou na lama!";
  },
  SOLTAR: () => {
    if (!mnt()) return "Nenhum tamanduá.";
    const n = mnt()!.name;
    econ.mount = null;
    return n + " voltou para a natureza.";
  },
  /* v7.7 — campanha: pular a missão atual, ou voltar ao começo (para testar cada ato) */
  PULARMISSAO: () => {
    const antes = missaoAtual();
    if (!antes) return "Não há missão: é o fim do que está pronto.";
    campanhaPular();
    const M = missaoAtual();
    return "Pulou “" + antes.titulo + "” · agora: " + (M ? M.titulo : "fim do que está pronto");
  },
  RECOMECAR: () => {
    const C = campanha();
    C.feitas = {};
    C.flags = {};
    delete C.paralela; // v8.0: a linha dos lobos abre de novo no cercado
    campanhaIr(MISSAO_INICIAL);
    return "Campanha do começo: " + missaoAtual()!.titulo;
  },
  /* v7.7 — campanha C2 (os lobos): atalhos para testar sem esperar os dias */
  MISSAOLOBO: () => {
    econ.introDone = true;
    econ.campTut = 3;
    econ.tent = true;
    econ.hunterNap = false;
    campanhaIr("a3_lobo");
    return "Missão: " + missaoAtual()!.titulo + " · lace um lobo numa expedição";
  },
  LOBONOVO: () => gsLobos("LOBO"),
  MEULOBO: () => gsLobos("MEULOBO"),
  LOBOMAIS: () => gsLobos("LOBOVINCULO"),
  LOBOMAX: () => gsLobos("LOBOMAX"),
  LOBOVOLTA: () => gsLobos("LOBOVOLTA"),
  FILHOTE: () => gsLobos("FILHOTE"),
  PEDIDO: () => gsPedido(),
  CARNE: () => {
    const n = gsItens([
      ["carne", "coelho", 3],
      ["carne", "cervo", 2],
      ["carne_assada", "cervo", 1],
    ]);
    return n + " carnes na mochila (coelho, cervo e uma de cervo assada)";
  },
  PELES: () => gsItens([["pele", "", 3]]) + " peles na mochila (para a armadura de couro)",
  // v8.0 — a sala de treino direto (os manequins dos personagens vestidos ficam lá: render/gl/vestidos.ts)
  TREINO: () => treinoDeQualquerLugar(),
  MODELOS: () => {
    treinoDeQualquerLugar();
    abrirModelosTeste();
    return "Prévia de modelos e animações aberta";
  },
  // v8.0 — tira a aparência vestida na sala de treino (render/gl/vestidos.ts)
  // v8.0 — joga com uma das deusas (vestidos.json, a mesma troca de malha dos manequins); o mesmo código de novo volta
  PRIMAVERA: () => gsDeusa("deusa_primavera"),
  VERAO: () => gsDeusa("deusa_verao"),
  OUTONO: () => gsDeusa("deusa_outono"),
  INVERNO: () => gsDeusa("deusa_inverno"),
  HEROINA: () => {
    if (!VESTIDO.atual) return "Você já é a heroína.";
    vestir(null);
    GL3.heroKey = "";
    return "De volta à heroína";
  },
};
/** Põe itens (chave, bicho, quantos) na mochila da primeira heroína; o que não couber vai para o baú. */
function gsItens(L: [string, string, number][]) {
  const h = world.heroes[0];
  let n = 0;
  if (!h) return 0;
  for (const [key, an, q] of L)
    for (let i = 0; i < q; i++) {
      // a carne crua empilha (PACK_KEYS) já dentro do tryAddToInv, pelo bicho de CACA.MEAT_SRC: o bicho certo vai
      // antes, senão ela juntava numa pilha de outro bicho e a marca ia para o item errado
      const src = CACA.MEAT_SRC;
      if (key === "carne") CACA.MEAT_SRC = an;
      let inv: InvGrid | null;
      try {
        inv = tryAddToInv(ensureInv(h), key, 0) ? ensureInv(h) : tryAddToInv(econ.stash, key, 0) ? econ.stash : null;
      } finally {
        CACA.MEAT_SRC = src;
      }
      if (!inv) continue;
      if (key !== "carne") {
        const it = inv.items[inv.items.length - 1]; // não empilha: é o último
        if (an) it.an = an;
        if (key === "carne_assada") it.qc = 0;
      }
      n++;
    }
  return n;
}
export function gsRun(code: string) {
  const k = String(code || "")
      .toUpperCase()
      .replace(/[^A-Z]/g, ""),
    f = GS_CODES[k];
  if (!f) {
    mvToast("🎮 Código inválido");
    return false;
  }
  const msg = f();
  mvToast("🎮 " + msg);
  sfx("perfect");
  try {
    if (MP.open) mpRender();
  } catch (_) {}
  return true;
}
export function gsOpen() {
  let m = document.getElementById("gs-modal");
  if (!m) {
    m = document.createElement("div");
    m.id = "gs-modal";
    m.className = "v3-modal";
    m.innerHTML =
      '<div class="v3-card" id="gs-card"><div class="mt-head"><b>🎮 GameShark</b><button class="btn" id="gs-x">✕</button></div><div class="gs-row"><input id="gs-code" placeholder="digite um código" maxlength="16"><button class="btn pri" id="gs-go">Ativar</button></div><div class="gs-list">' +
      [
        ["ARMAS", "uma de cada arma no baú"],
        ["JOIAS", "7 gemas variadas (todos os estágios) no baú"],
        ["TAMANDUA", "ganha um tamanduá já domado"],
        ["PELAGEM", "troca a pelagem (testar as 8)"],
        ["SUJAR", "deixa ele imundo de lama"],
        ["VINCULO", "vínculo máximo (nível 4)"],
        ["CUPIM", "+20 cupins"],
        ["DOMAFACIL", "botão de domar na hora"],
        ["OURO", "+1000 de ouro"],
        ["SOLTAR", "solta o tamanduá"],
        ["PULARMISSAO", "pula a missão atual da campanha"],
        ["RECOMECAR", "campanha do começo"],
        ["MISSAOLOBO", "vai para a missão de laçar o lobo"],
        ["LOBONOVO", "um lobo do Caçador no cercado"],
        ["MEULOBO", "um lobo seu no cercado"],
        ["LOBOMAIS", "+1 nível de vínculo nos lobos"],
        ["LOBOMAX", "lobos no vínculo 4"],
        ["LOBOVOLTA", "traz de volta os lobos fugidos"],
        ["FILHOTE", "casal no vínculo 4 e nasce o filhote"],
        ["PEDIDO", "o Caçador pede carne agora"],
        ["CARNE", "carnes de coelho e cervo na mochila"],
        ["PELES", "3 peles na mochila"],
        ["TREINO", "sala de treino com os manequins (E veste o personagem)"],
        ["HEROINA", "tira a aparência vestida na sala de treino"],
        ["PRIMAVERA", "joga com a Deusa da Primavera"],
        ["VERAO", "joga com a Deusa do Verão"],
        ["OUTONO", "joga com a Deusa do Outono"],
        ["INVERNO", "joga com a Deusa do Inverno"],
      ]
        .map(([c, d]) => "<button class='btn' data-gs='" + c + "'><b>" + c + "</b><small>" + d + "</small></button>")
        .join("") +
      "</div><p class='gs-tip'>Também dá para digitar o código direto no mapa, sem abrir esta janela.</p></div>";
    document.body.appendChild(m);
    (m.querySelector("#gs-x") as HTMLElement).onclick = () => m!.classList.remove("open");
    (m.querySelector("#gs-go") as HTMLElement).onclick = () =>
      gsRun((m!.querySelector("#gs-code") as HTMLInputElement).value);
    m.querySelector<HTMLInputElement>("#gs-code")!.addEventListener("keydown", (e) => {
      if (e.key === "Enter") gsRun((e.target as HTMLInputElement).value);
      e.stopPropagation();
    });
    m.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("[data-gs]") as HTMLElement;
      if (b) gsRun(b.dataset.gs!);
    });
  }
  m.classList.add("open");
  setTimeout(() => (m.querySelector("#gs-code") as HTMLElement).focus(), 50);
}
