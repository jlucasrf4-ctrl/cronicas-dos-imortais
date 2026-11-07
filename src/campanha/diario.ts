/* ==== v8.0 — a aba de missões (pedido do mantenedor, 2026-10-23: "qual missão você tá, dicas e fechar") ====
   J (ou clicar no quadro do objetivo, #missao) abre a janela #diario: a missão atual (ato, título, objetivo ou o
   pedido de carne em aberto, o ❗ quando o Caçador chama), as dicas da missão (`dicas` em data/campanha.ts) e as
   missões já feitas, por ato, na ordem da corrente. ✕, J ou Esc fecham. No campo o jogo pausa enquanto ela está
   aberta (dungeon.modalOpen, só se estava livre). v8.0: a linha paralela dos lobos tem o seu bloco e as suas feitas. */
import { dungeon } from "../core/state.ts";
import { ATOS, LINHAS, MISSAO_INICIAL, MISSOES } from "../data/campanha.ts";
import type { Missao } from "../data/campanha.ts";
import { campanha, chamadoAtual, missaoAtual, missaoParalela } from "./campanha.ts";
import { pedidoAtual } from "./pedidos.ts";
import { esc } from "../core/util.ts";

/** aberta: a janela está na tela; pausou: foi ela que pausou o campo (devolve ao fechar). */
const DIARIO = { aberta: false, pausou: false };

/** As missões feitas de uma corrente (de `inicio` até `ate`), agrupadas por `grupo`; títulos repetidos seguidos viram
    um só. */
function feitasDa(inicio: string | null, ate: string | null | undefined, grupo: (M: Missao) => string) {
  const C = campanha(),
    grupos: Record<string, string[]> = {};
  for (let id = inicio, n = 0; id && MISSOES[id] && n < 200; id = MISSOES[id].proxima, n++) {
    if (id === ate) break;
    if (C.feitas[id] == null) continue;
    const M = MISSOES[id],
      l = (grupos[grupo(M)] ||= []);
    if (l[l.length - 1] !== M.titulo) l.push(M.titulo);
  }
  return grupos;
}

/** Uma missão em aberto: título, objetivo (ou o pedido de carne), o ❗ se é ela que chama, as dicas. */
function secao(M: Missao, classe: string, rotulo: string) {
  let h =
    "<section class='" +
    classe +
    "'><small>" +
    esc(rotulo) +
    "</small><h3>" +
    esc(M.titulo) +
    "</h3><p>" +
    esc((M.pedido && pedidoAtual()) || M.objetivo) +
    "</p>";
  if (M.chamado && chamadoAtual() === M.chamado) h += "<p class='chamado'>❗ O Caçador quer falar com você</p>";
  if (M.dicas && M.dicas.length)
    h += "<h4>Dicas</h4><ul>" + M.dicas.map((d) => "<li>" + esc(d) + "</li>").join("") + "</ul>";
  if (!M.conclui) h += "<p class='fim'>Por enquanto a história para aqui. O próximo ato está em produção.</p>";
  return h + "</section>";
}

function html() {
  const M = missaoAtual(),
    L = missaoParalela(),
    C = campanha();
  let h = "<header><b>📜 Missões</b><button class='btn' id='diario-x' title='Fechar (J ou Esc)'>✕</button></header>";
  if (M) h += secao(M, "atual", "Ato " + M.ato + " · " + (ATOS[M.ato] || ""));
  else if (!L) h += "<section class='atual'><p>Nenhuma missão no momento.</p></section>";
  // v8.0: a linha paralela (os lobos)
  if (L) h += secao(L, "paralela", "🐺 " + (LINHAS[L.linha!] || ""));
  // um pedido de carne novo é chamado, mas não de missão: o aviso vai no fim
  if (chamadoAtual() === "pedido") h += "<p class='chamado'>❗ O Caçador quer falar com você</p>";
  const atos = feitasDa(MISSAO_INICIAL, C.etapa, (X) => "Ato " + X.ato + " · " + (ATOS[X.ato] || "")),
    abre = MISSOES.a3_cercado.abre || null,
    lobos = C.paralela === undefined ? {} : feitasDa(abre, C.paralela, (X) => "🐺 " + (LINHAS[X.linha!] || "")),
    grupos = { ...atos, ...lobos },
    nomes = Object.keys(grupos);
  if (nomes.length) {
    h += "<section class='feitas'><h4>Concluídas</h4>";
    for (const g of nomes)
      h +=
        "<div><small>" +
        esc(g) +
        "</small><ul>" +
        grupos[g].map((t) => "<li>✔ " + esc(t) + "</li>").join("") +
        "</ul></div>";
    h += "</section>";
  }
  return h + "<footer><kbd>J</kbd> abre e fecha</footer>";
}

function janela() {
  let el = document.getElementById("diario");
  if (!el) {
    el = document.createElement("div");
    el.id = "diario";
    el.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).id === "diario-x") fecharDiario();
    });
    document.body.appendChild(el);
  }
  return el;
}

export function abrirDiario() {
  if (DIARIO.aberta) return;
  const tit = document.getElementById("title-screen");
  if (tit && tit.classList.contains("open")) return;
  if (dungeon.active && dungeon.mode === "intro") return; // a cena inicial guia sozinha
  DIARIO.aberta = true;
  DIARIO.pausou = false;
  if (dungeon.active && !dungeon.modalOpen) {
    dungeon.modalOpen = true;
    DIARIO.pausou = true;
  }
  const el = janela();
  el.innerHTML = html();
  el.classList.add("on");
}
function fecharDiario() {
  if (!DIARIO.aberta) return;
  DIARIO.aberta = false;
  if (DIARIO.pausou) dungeon.modalOpen = false;
  DIARIO.pausou = false;
  janela().classList.remove("on");
}
function alternarDiario() {
  if (DIARIO.aberta) fecharDiario();
  else abrirDiario();
}
/** Tecla (iniciarCampanha chama): J abre/fecha; Esc fecha. Devolve se usou a tecla. */
export function teclaDiario(code: string) {
  if (code === "KeyJ") {
    alternarDiario();
    return true;
  }
  if (code === "Escape" && DIARIO.aberta) {
    fecharDiario();
    return true;
  }
  return false;
}
