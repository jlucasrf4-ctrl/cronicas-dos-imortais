/* ==== v8.1 — Modo Editor: carregar, desfazer/refazer e gravar a decoração (src/assets/map/decoracao.json) ====
   Com o jogo aberto pelo modo ao vivo ("Abrir jogo ao vivo.bat", npm run dev), gravar escreve o arquivo de verdade pelo
   servidor (tools/vite-plugin-jogo.ts, /__editor/…) e guarda cópias com data em editor-historico/; o próximo build já
   sai com a decoração. Aberto do disco (dist/game.html), grava no navegador (localStorage) e oferece baixar o arquivo.
   Toda mudança vai também para um rascunho no navegador: se a página fechar antes de gravar, o editor oferece
   recuperar. Desfazer guarda o arquivo inteiro a cada passo (é pequeno). */
import { EDITOR } from "../data/editor.ts";
import { ED, dadosVazios, type DadosEditor } from "./estado.ts";

const ARQUIVO = /* @inline-json src/assets/map/decoracao.json */ {} as Partial<DadosEditor>;
const RASCUNHO = "mv_editor_rascunho";

function normalizar(d: Partial<DadosEditor> | null | undefined): DadosEditor {
  const v = dadosVazios();
  if (!d || typeof d !== "object") return v;
  return {
    versao: 1,
    cenas: d.cenas || {},
    recados: d.recados || {},
    conjuntos: d.conjuntos || {},
    terreno: d.terreno || [],
    removidos: d.removidos || [],
    aparencias: d.aparencias || {},
    proximo: d.proximo || 1,
    salvoEm: d.salvoEm,
  };
}
const copia = (d: DadosEditor) => JSON.parse(JSON.stringify(d)) as DadosEditor;

/** Lê a decoração embutida no jogo (no carregamento). */
export function carregarDecoracao() {
  ED.dados = normalizar(ARQUIVO);
  ED.antes = copia(ED.dados);
  ED.versao++;
}

/** O estado da gravação, para a barra do editor. servidor: null = ainda não sei; sujo: mudou desde a última
 *  gravação; msg: o que mostrar. */
export const SALVO = {
  sujo: false,
  servidor: null as boolean | null,
  msg: "",
  gravando: false,
  ultimoHistorico: 0,
  timer: 0 as ReturnType<typeof setTimeout> | 0,
  aoMudar: null as (() => void) | null,
};
const PILHA = { desfazer: [] as string[], refazer: [] as string[], aberta: null as string | null };

export function novoId() {
  return ED.dados.proximo++;
}

/** Uma mudança de uma vez só (clique, botão): guarda o antes para desfazer. */
export function mudar(fn: () => void) {
  const antes = JSON.stringify(ED.dados);
  fn();
  fechar(antes);
}
/** Uma mudança que dura (arrastar, pintar): abrirMudanca no começo, fecharMudanca no fim (um passo de desfazer). */
export function abrirMudanca() {
  if (PILHA.aberta == null) PILHA.aberta = JSON.stringify(ED.dados);
}
export function fecharMudanca() {
  if (PILHA.aberta == null) return;
  const antes = PILHA.aberta;
  PILHA.aberta = null;
  fechar(antes);
}
/** No meio de uma mudança que dura: a cena redesenha, sem passo novo de desfazer. */
export function mexeu() {
  ED.versao++;
}
function fechar(antes: string) {
  if (antes === JSON.stringify(ED.dados)) return;
  PILHA.desfazer.push(antes);
  if (PILHA.desfazer.length > EDITOR.desfazer) PILHA.desfazer.shift();
  PILHA.refazer.length = 0;
  sujou();
}
function sujou() {
  ED.versao++;
  SALVO.sujo = true;
  SALVO.msg = "não salvo";
  try {
    localStorage.setItem(RASCUNHO, JSON.stringify({ quando: new Date().toISOString(), dados: ED.dados }));
  } catch (_) {}
  if (SALVO.timer) clearTimeout(SALVO.timer);
  SALVO.timer = setTimeout(() => void salvar(false), EDITOR.autoSalvar * 1000);
  SALVO.aoMudar?.();
}
export function podeDesfazer() {
  return PILHA.desfazer.length > 0;
}
export function podeRefazer() {
  return PILHA.refazer.length > 0;
}
export function desfazer() {
  const s = PILHA.desfazer.pop();
  if (s == null) return false;
  PILHA.refazer.push(JSON.stringify(ED.dados));
  ED.dados = normalizar(JSON.parse(s));
  ED.selecionados.clear();
  sujou();
  return true;
}
export function refazer() {
  const s = PILHA.refazer.pop();
  if (s == null) return false;
  PILHA.desfazer.push(JSON.stringify(ED.dados));
  ED.dados = normalizar(JSON.parse(s));
  ED.selecionados.clear();
  sujou();
  return true;
}
/** Troca a decoração inteira (uma versão do histórico, o rascunho recuperado) — dá para desfazer. */
export function trocarDados(novo: Partial<DadosEditor>) {
  mudar(() => {
    const n = normalizar(novo);
    n.proximo = Math.max(n.proximo, ED.dados.proximo);
    ED.dados = n;
    ED.selecionados.clear();
  });
}

const naWeb = () => typeof location !== "undefined" && /^https?:$/.test(location.protocol);
/** O servidor ao vivo está aí? (só pergunta uma vez) */
export async function temServidor() {
  if (SALVO.servidor != null) return SALVO.servidor;
  if (!naWeb()) return (SALVO.servidor = false);
  try {
    const r = await fetch("/__editor/ping");
    SALVO.servidor = r.ok && (await r.text()) === "ok";
  } catch (_) {
    SALVO.servidor = false;
  }
  return SALVO.servidor;
}

/** Grava. manual: o botão Salvar / Ctrl+S (também guarda uma cópia no histórico; sem servidor, baixa o arquivo). */
export async function salvar(manual: boolean) {
  if (SALVO.timer) {
    clearTimeout(SALVO.timer);
    SALVO.timer = 0;
  }
  if (SALVO.gravando) return;
  if (!SALVO.sujo && !manual) return;
  SALVO.gravando = true;
  ED.dados.salvoEm = new Date().toISOString();
  const texto = JSON.stringify(ED.dados, null, 1);
  try {
    if (await temServidor()) {
      const agora = Date.now(),
        historico = manual || agora - SALVO.ultimoHistorico > EDITOR.historico * 60000;
      const r = await fetch("/__editor/salvar" + (historico ? "?historico=1" : ""), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: texto,
      });
      if (!r.ok) throw new Error(await r.text());
      if (historico) SALVO.ultimoHistorico = agora;
      SALVO.sujo = false;
      SALVO.msg = "salvo ✓ " + new Date().toLocaleTimeString().slice(0, 5);
      ED.antes = copia(ED.dados);
      try {
        localStorage.removeItem(RASCUNHO);
      } catch (_) {}
    } else {
      try {
        localStorage.setItem(RASCUNHO, JSON.stringify({ quando: ED.dados.salvoEm, dados: ED.dados }));
      } catch (_) {}
      SALVO.sujo = false;
      SALVO.msg = "salvo no navegador";
      if (manual) baixar(texto);
    }
  } catch (e) {
    SALVO.msg = "erro ao salvar: " + String((e as Error).message || e).slice(0, 80);
  } finally {
    SALVO.gravando = false;
    SALVO.aoMudar?.();
  }
}
/** Baixa o arquivo (sem o modo ao vivo: o mantenedor põe em src/assets/map/). */
function baixar(texto = JSON.stringify(ED.dados, null, 1)) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([texto], { type: "application/json" }));
  a.download = "decoracao.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Há um rascunho no navegador mais novo que o arquivo e diferente dele? (a página fechou sem gravar) */
export function rascunhoPendente(): { quando: string; dados: DadosEditor } | null {
  try {
    const r = JSON.parse(localStorage.getItem(RASCUNHO) || "null") as { quando: string; dados: DadosEditor } | null;
    if (!r || !r.dados) return null;
    if (ED.dados.salvoEm && r.quando <= ED.dados.salvoEm) return null;
    if (JSON.stringify(normalizar(r.dados).cenas) === JSON.stringify(ED.dados.cenas)) return null;
    return r;
  } catch (_) {
    return null;
  }
}
export function descartarRascunho() {
  try {
    localStorage.removeItem(RASCUNHO);
  } catch (_) {}
}

/** As cópias guardadas em editor-historico/ (mais novas primeiro). */
export async function listarHistorico(): Promise<{ arq: string; quando: string; pecas: number; recados: number }[]> {
  if (!(await temServidor())) return [];
  try {
    const r = await fetch("/__editor/historico");
    return r.ok ? await r.json() : [];
  } catch (_) {
    return [];
  }
}
export async function lerVersao(arq: string): Promise<DadosEditor | null> {
  try {
    const r = await fetch("/__editor/versao?arq=" + encodeURIComponent(arq));
    return r.ok ? normalizar(await r.json()) : null;
  } catch (_) {
    return null;
  }
}
