/* ==== v8.1 — o Modo Editor (F2 no campo): decorar o mundo vendo ao vivo (mantenedor 2026-10-31) ====
   Abre por cima do campo (o campo aberto, a vila, o acampamento, a sala de treino), pausa o jogo e solta a câmera.
   Biblioteca à esquerda (o que o jogo já tem + "Meus modelos" da pasta modelos-novos/ + luzes, efeitos e sons), o
   inspetor e as camadas à direita, as ferramentas em cima:
     Mover (V): clique seleciona (Shift soma), arrastar move, arrastar no vazio = caixa de seleção, Alt+arrastar copia
     Colocar: clique numa peça da biblioteca e clique no chão (ou arraste a peça da biblioteca para o chão)
     Pincel (P): pinta várias peças do mesmo tipo com variação; Shift apaga; [ e ] mudam o tamanho do pincel
     Recado (N): um alfinete com um pedido para o Claude
   Roda: gira o selecionado (Shift: tamanho; sem seleção ou com Ctrl: aproxima). Botão do meio/direito ou WASD: anda
   com a câmera. Q/E giram, +/− mudam o tamanho, PgUp/PgDn sobem/descem, Del apaga, Ctrl+D duplica, Ctrl+C/Ctrl+V,
   Ctrl+Z/Ctrl+Y, Ctrl+S salva, G liga a grade, H esconde os painéis, Espaço (segurando) mostra o antes, T testa
   (a heroína aparece onde o mouse está e o editor fecha). Tudo grava sozinho alguns segundos depois de mexer
   (editor/dados.ts). As peças aparecem no jogo também com o editor fechado (editor/cena.ts). */
import { GL3, SEL, dungeon, world, TELAS } from "../core/state.ts";
import { mvToast } from "../ui/avisos.ts";
import { JOGO } from "../ui/modos.ts";
import { launchDungeon } from "../expedicao/preparo.ts";
import { D3 } from "../field/projecao.ts";
import { CZ } from "../field/tipos.ts";
import { CAMADAS, CATEGORIAS, EDITOR, EFEITOS, ESTACOES, LUZES, SONS } from "../data/editor.ts";
import { ED, type DadosEditor, type Deco, type Recado, type Traco } from "./estado.ts";
import { MUNDO } from "../map/mundo.ts";
import { terrenoMudou } from "../map/terreno.ts";
import { MAPART, mapaTerrenoMudou } from "../map/vetorial.ts";
import { alturaChao, pecasDoMapa, refazerBlocos, type PecaMapa } from "../render/gl/mundo_cena.ts";
import { SOB, SOM, camadaDe, cantoCena, cenaAtual } from "./cena.ts";
import {
  esquecerMalhas,
  infoModelo,
  listarModelos,
  malhaModelo,
  miniatura,
  trocarImportados,
  variantes,
} from "./modelos.ts";
import {
  SALVO,
  abrirMudanca,
  carregarDecoracao,
  descartarRascunho,
  desfazer,
  fecharMudanca,
  lerVersao,
  listarHistorico,
  mexeu,
  mudar,
  novoId,
  podeDesfazer,
  podeRefazer,
  rascunhoPendente,
  refazer,
  salvar,
  temServidor,
  trocarDados,
} from "./dados.ts";
import { pararSomAmbiente } from "./som.ts";
import { alternarAparencias, galeriaRotulos } from "./aparencias_qc.ts";

const NOMES_CENA: Record<string, string> = {
  mundo: "Campo aberto",
  vila: "Vila Musgo",
  acamp: "Acampamento",
  treino: "Sala de treino",
};
const PREFS = "mv_editor_prefs";
const ALTURA_PAVIMENTO = 84; // 4 células da grade de 21 px, compatível com a escala do campo.

type Ferramenta = "mover" | "colocar" | "pincel" | "terreno" | "recado";
type Arrasto =
  | {
      tipo: "mover";
      x0: number;
      z0: number;
      cx0: number;
      cy0: number;
      orig: Map<number, [number, number]>;
      mexeu: boolean;
      copiar: boolean;
    }
  | { tipo: "caixa"; cx0: number; cy0: number; cx1: number; cy1: number; somar: boolean }
  | { tipo: "camera"; cx0: number; cy0: number; camX: number; camZ: number; mexeu: boolean; peca: Deco | null }
  | { tipo: "pincel"; ux: number; uz: number; apagar: boolean }
  | { tipo: "terreno"; ux: number; uz: number; modo: "terra" | "agua" }
  | { tipo: "mini" }
  | { tipo: "card"; id: string; conjunto: string | null; cx0: number; cy0: number; mexeu: boolean };

const UI = {
  raiz: null as HTMLElement | null,
  tela: null as HTMLCanvasElement | null,
  ferramenta: "mover" as Ferramenta,
  modelo: null as string | null,
  conjunto: null as string | null,
  cat: "arvores",
  busca: "",
  grade: false,
  variar: true,
  paineis: true,
  pincelRaio: EDITOR.pincel.raio,
  terrenoModo: "terra" as "terra" | "agua",
  mini: true,
  travadas: new Set<string>(),
  zoom: 1,
  base: { s: 1, k: 1, pausado: false },
  arrasto: null as Arrasto | null,
  teclas: new Set<string>(),
  mouse: { x: -1, y: -1, naCena: false },
  copiados: [] as Deco[],
  roda: 0 as ReturnType<typeof setTimeout> | 0,
  status: 0,
  aviso: { texto: "", ate: 0 },
  recado: null as { r: Recado; el: HTMLElement } | null,
  inspetorDe: "",
  pavimento: 0,
};

/* ---------------- coordenadas ---------------- */
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => UI.raiz!.querySelector<T>(sel)!;
const r1 = (v: number) => Math.round(v * 10) / 10;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const entre = (a: [number, number]) => a[0] + Math.random() * (a[1] - a[0]);
const invisivel = (m: string) => /^(luz|fx|som):/.test(m);
/** A altura do chão no ponto absoluto (só o campo aberto tem relevo). */
const chaoEm = (ax: number, az: number) => (cenaAtual() === "mundo" ? alturaChao(ax, az) : 0);

/** O ponto do chão (absoluto) sob o ponto da tela (cliente). */
function chaoSob(px: number, py: number) {
  const r = TELAS.dCanvas.getBoundingClientRect(),
    c = cantoCena(),
    sx = ((px - r.left) * D3.cw) / (r.width || 1),
    sy = ((py - r.top) * D3.ch) / (r.height || 1),
    S = D3.SIN || 0.7,
    C = D3.COS || 0.7,
    x = D3.cx + (sx - D3.cw / 2) / D3.s,
    z0 = D3.cz + (sy - D3.ch / 2 - D3.vy) / (S * D3.s);
  let z = z0;
  for (let k = 0; k < 2; k++) z = z0 + (chaoEm(x + c.x, z + c.y) * C) / S;
  return { x: x + c.x, z: z + c.y };
}
/** O ponto absoluto (x, z, altura h acima do chão) na tela (cliente). */
function telaDe(ax: number, az: number, h = 0) {
  const r = TELAS.dCanvas.getBoundingClientRect(),
    c = cantoCena(),
    X = ax - c.x,
    Z = az - c.y,
    y = chaoEm(ax, az) + h,
    sx = D3.cw / 2 + (X - D3.cx) * D3.s,
    sy = D3.ch / 2 + D3.vy + (Z - D3.cz) * (D3.SIN || 0.7) * D3.s - y * (D3.COS || 0.7) * D3.s;
  return {
    x: r.left + (sx * r.width) / (D3.cw || 1),
    y: r.top + (sy * r.height) / (D3.ch || 1),
    k: r.width / (D3.cw || 1),
  };
}
function naGrade(v: number) {
  return UI.grade ? Math.round(v / EDITOR.grade) * EDITOR.grade : v;
}

/* ---------------- a lista de peças ---------------- */
function pecasLer(): Deco[] {
  const c = cenaAtual();
  return ((c && ED.dados.cenas[c]) || []).filter((p) => (p.pavimento || 0) === ED.pavimento);
}
function pecasMudar(): Deco[] {
  const c = cenaAtual()!;
  return (ED.dados.cenas[c] ||= []);
}
function recadosLer(): Recado[] {
  const c = cenaAtual();
  return (c && ED.dados.recados[c]) || [];
}
function selecionadas() {
  return pecasLer().filter((p) => ED.selecionados.has(p.id));
}
const editavel = (p: Deco) => !ED.camadasOcultas.has(camadaDe(p)) && !UI.travadas.has(camadaDe(p));

/** A caixa da peça na tela: a base, a altura e a largura (px do cliente). */
function caixaNaTela(p: Deco) {
  const t = telaDe(p.x, p.z, (p.y || 0) + (p.pavimento || 0) * ALTURA_PAVIMENTO);
  if (invisivel(p.m)) return { bx: t.x, by: t.y - 12, hw: 14, topo: t.y - 26, baixo: t.y + 2 };
  const mm = malhaModelo(p.m),
    e = p.e || 1,
    r = (mm?.r || 8) * e,
    h = (mm?.h || 10) * e,
    k = D3.s * t.k;
  return {
    bx: t.x,
    by: t.y,
    hw: Math.max(7, r * k * 0.8),
    topo: t.y - h * (D3.COS || 0.7) * k - 2,
    baixo: t.y + Math.max(5, r * (D3.SIN || 0.7) * k * 0.7),
  };
}
/** A peça sob o cursor (a da frente), só das camadas visíveis e destravadas. */
function pecaSob(px: number, py: number): Deco | null {
  let melhor: Deco | null = null,
    mz = -Infinity;
  for (const p of pecasLer()) {
    if (!editavel(p)) continue;
    const b = caixaNaTela(p);
    if (Math.abs(px - b.bx) > b.hw || py < b.topo || py > b.baixo) continue;
    if (p.z > mz) {
      mz = p.z;
      melhor = p;
    }
  }
  return melhor;
}
function recadoSob(px: number, py: number): Recado | null {
  if (ED.camadasOcultas.has("recados")) return null;
  for (const r of recadosLer()) {
    const t = telaDe(r.x, r.z, 0);
    if (Math.hypot(px - t.x, py - (t.y - 16)) < 16) return r;
  }
  return null;
}

/* ---------------- ações ---------------- */
function aviso(texto: string, ms = 2600) {
  UI.aviso = { texto, ate: performance.now() + ms };
  atualizarStatus();
}
function bloqueado() {
  if (ED.vendoAntes) {
    aviso("Solte o Espaço (ou o botão Antes/Depois) para voltar a editar.");
    return true;
  }
  return false;
}
/** Uma peça nova do modelo m no ponto absoluto (com a variação de giro e tamanho, se ligada). */
function novaPeca(m: string, x: number, z: number, variar = UI.variar): Deco {
  const p: Deco = { id: novoId(), m, x: r1(naGrade(x)), z: r1(naGrade(z)), pavimento: ED.pavimento, categoria: infoModelo(m)?.cat };
  if (m.startsWith("luz:")) p.raio = LUZES[m.slice(4)]?.raio;
  else if (m.startsWith("fx:")) p.raio = EFEITOS[m.slice(3)]?.raio;
  else if (m.startsWith("som:")) p.raio = SONS[m.slice(4)]?.raio;
  else if (variar) {
    p.g = r3(Math.random() * Math.PI * 2);
    p.e = r3(entre(EDITOR.pincel.variar));
  }
  return p;
}
function exportarConstrucao() {
  const cena = cenaAtual();
  if (!cena) return;
  const pacote = { formato: "cronicas-construcao", versao: 1, cena, grade: EDITOR.grade, alturaPavimento: ALTURA_PAVIMENTO, pecas: (ED.dados.cenas[cena] || []).map((p) => ({ ...p, categoria: p.categoria || infoModelo(p.m)?.cat || "importado" })) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(pacote, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `construcao-${cena}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  aviso("Construção exportada em JSON");
}
function importarConstrucao() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.onchange = () => {
    const f = input.files?.[0], cena = cenaAtual();
    if (!f || !cena) return;
    void f.text().then((texto) => {
      try {
        const dado = JSON.parse(texto) as { formato?: string; versao?: number; pecas?: Deco[] };
        if (dado.formato !== "cronicas-construcao" || dado.versao !== 1 || !Array.isArray(dado.pecas)) throw new Error("Formato incompatível");
        if (dado.pecas.some((p) => typeof p.m !== "string" || !Number.isFinite(p.x) || !Number.isFinite(p.z))) throw new Error("Há peças inválidas no arquivo");
        const importadas = dado.pecas.map((p) => ({ ...p, id: novoId(), pavimento: p.pavimento === 1 ? 1 : 0 }));
        mudar(() => (ED.dados.cenas[cena] ||= []).push(...importadas));
        selecionar(importadas.filter((p) => (p.pavimento || 0) === ED.pavimento).map((p) => p.id));
        aviso(`${importadas.length} peças importadas · Ctrl+Z desfaz`);
      } catch (e) { aviso("Não foi possível importar: " + String(e instanceof Error ? e.message : e), 5000); }
    });
  };
  input.click();
}
function selecionar(ids: number[], somar = false) {
  if (!somar) {
    ED.selecionados.clear();
    ORIG.sel.clear();
  }
  for (const id of ids) ED.selecionados.add(id);
  atualizarInspetor();
}

/* ---------------- as peças do próprio mapa (árvores, pedras, mato): só selecionar e apagar ---------------- */
/** sel: as selecionadas (id → a peça); sob: a do cursor. Apagar = o id vai para ED.dados.removidos e o bloco é refeito
 *  sem ela (render/gl/mundo_cena.ts). Elas não se movem: são do mapa. */
const ORIG = { sel: new Map<string, PecaMapa>(), sob: null as PecaMapa | null };
const origEditavel = () =>
  cenaAtual() === "mundo" && !ED.camadasOcultas.has("natureza") && !UI.travadas.has("natureza");
/** A altura (px) que a peça do mapa ocupa na tela, para clicar na copa da árvore. */
const altOrig = (o: PecaMapa) => (o.tipo === "arvore" ? o.r * 6.5 : o.r * 1.6);
function originalSob(px: number, py: number): PecaMapa | null {
  if (!origEditavel()) return null;
  const P = chaoSob(px, py),
    k = D3.s * telaDe(P.x, P.z).k;
  let melhor: PecaMapa | null = null;
  for (const o of pecasDoMapa(P.x - 160, P.z - 40, P.x + 160, P.z + 240)) {
    const t = telaDe(o.x, o.z),
      hw = Math.max(8, o.r * k * 0.9);
    if (
      Math.abs(px - t.x) > hw ||
      py > t.y + Math.max(5, o.r * (D3.SIN || 0.7) * k) ||
      py < t.y - altOrig(o) * (D3.COS || 0.7) * k
    )
      continue;
    if (!melhor || o.z > melhor.z) melhor = o;
  }
  return melhor;
}
function apagarOriginais(ids: string[]) {
  if (!ids.length) return;
  mudar(() => {
    const L = (ED.dados.removidos ||= []);
    for (const id of ids) if (!L.includes(id)) L.push(id);
  });
  ORIG.sel.clear();
}
function colocarEm(ax: number, az: number) {
  if (bloqueado() || !cenaAtual()) return;
  if (UI.conjunto) {
    const C = ED.dados.conjuntos[UI.conjunto];
    if (!C) return;
    const novos: number[] = [];
    mudar(() => {
      for (const q of C) {
        const p = { ...q, id: novoId(), x: r1(naGrade(ax) + q.x), z: r1(naGrade(az) + q.z) };
        pecasMudar().push(p);
        novos.push(p.id);
      }
    });
    selecionar(novos);
    return;
  }
  if (!UI.modelo) return;
  const p = novaPeca(UI.modelo, ax, az);
  mudar(() => pecasMudar().push(p));
  selecionar([p.id]);
}
function apagarSelecionados() {
  if (bloqueado()) return;
  if (ORIG.sel.size) {
    const n = ORIG.sel.size;
    apagarOriginais([...ORIG.sel.keys()]);
    if (!ED.selecionados.size) {
      atualizarInspetor();
      aviso((n === 1 ? "Apagada do mapa" : n + " peças apagadas do mapa") + " (Ctrl+Z desfaz)");
      return;
    }
  }
  if (!ED.selecionados.size) return;
  const n = ED.selecionados.size;
  mudar(() => {
    const c = cenaAtual()!;
    ED.dados.cenas[c] = pecasMudar().filter((p) => !ED.selecionados.has(p.id));
  });
  ED.selecionados.clear();
  atualizarInspetor();
  aviso(n === 1 ? "Apagado (Ctrl+Z desfaz)" : n + " peças apagadas (Ctrl+Z desfaz)");
}
function duplicar(dx = EDITOR.grade, dz = EDITOR.grade) {
  if (bloqueado()) return;
  const sel = selecionadas();
  if (!sel.length) return;
  const novos: number[] = [];
  mudar(() => {
    for (const q of sel) {
      const p = { ...q, id: novoId(), x: r1(q.x + dx), z: r1(q.z + dz) };
      pecasMudar().push(p);
      novos.push(p.id);
    }
  });
  selecionar(novos);
}
function copiar() {
  const sel = selecionadas();
  if (!sel.length) return;
  const cx = sel.reduce((a, p) => a + p.x, 0) / sel.length,
    cz = sel.reduce((a, p) => a + p.z, 0) / sel.length;
  UI.copiados = sel.map((p) => ({ ...p, x: p.x - cx, z: p.z - cz }));
  aviso(sel.length + " copiada(s) · Ctrl+V cola onde o mouse está");
}
function colar() {
  if (bloqueado() || !UI.copiados.length) return;
  const alvo = UI.mouse.naCena ? chaoSob(UI.mouse.x, UI.mouse.y) : centroCamera(),
    novos: number[] = [];
  mudar(() => {
    for (const q of UI.copiados) {
      const p = { ...q, id: novoId(), x: r1(naGrade(alvo.x) + q.x), z: r1(naGrade(alvo.z) + q.z) };
      pecasMudar().push(p);
      novos.push(p.id);
    }
  });
  selecionar(novos);
}
/** Gira/escala/sobe o selecionado; vindo da roda ou de tecla repetida, junta num passo só de desfazer. */
function ajustar(fn: (p: Deco) => void) {
  if (bloqueado()) return;
  const sel = selecionadas();
  if (!sel.length) return;
  abrirMudanca();
  for (const p of sel) fn(p);
  mexeu();
  if (UI.roda) clearTimeout(UI.roda);
  UI.roda = setTimeout(() => {
    UI.roda = 0;
    fecharMudanca();
    atualizarInspetor(true);
  }, 450);
}
const girar = (graus: number) =>
  ajustar((p) => (p.g = r3(((((p.g || 0) + (graus * Math.PI) / 180) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2))));
const escalar = (k: number) => ajustar((p) => (p.e = r3(Math.max(0.05, Math.min(20, (p.e || 1) * k)))));
const subir = (dy: number) => ajustar((p) => (p.y = r1((p.y || 0) + dy)));

function centroCamera() {
  const c = cantoCena();
  return { x: D3.cx + c.x, z: D3.cz + c.y };
}
/** Fecha o editor e põe a heroína no ponto (absoluto) para jogar ali. */
function testarAqui() {
  const alvo = UI.mouse.naCena ? chaoSob(UI.mouse.x, UI.mouse.y) : centroCamera();
  fecharEditor();
  const d = dungeon,
    c = cantoCena(),
    T = d.tile;
  let x = alvo.x - c.x,
    y = alvo.z - c.y;
  if (cenaAtual() !== "mundo") {
    x = Math.max(T, Math.min(d.cols * T - T, x));
    y = Math.max(T, Math.min(d.rows * T - T, y));
  }
  d.px = x;
  d.py = y;
  d.moveTarget = null;
  D3.cx = x;
  D3.cz = y;
}
function salvarConjunto(nome: string) {
  const sel = selecionadas();
  if (!sel.length || !nome.trim()) return;
  const cx = sel.reduce((a, p) => a + p.x, 0) / sel.length,
    cz = sel.reduce((a, p) => a + p.z, 0) / sel.length;
  mudar(() => {
    ED.dados.conjuntos[nome.trim()] = sel.map((p) => ({ ...p, id: 0, x: r1(p.x - cx), z: r1(p.z - cz) }));
  });
  UI.cat = "conjuntos";
  montarBiblioteca();
  aviso("Conjunto “" + nome.trim() + "” salvo na biblioteca");
}

/* ---------------- abrir e fechar ---------------- */
function abrirEditor() {
  if (ED.on) return;
  const cena = cenaAtual();
  if (!dungeon.active || !cena) return;
  if (!D3.gl) {
    alert("O Modo Editor precisa da visão 3D ligada (botão 🧊 3D).");
    return;
  }
  if (!UI.raiz) montarUI();
  ED.on = true;
  UI.ferramenta = "mover";
  UI.arrasto = null;
  UI.teclas.clear();
  // as árvores e pedras postas saem do cenário cortável e voltam a ser peças soltas, para mexer (mundo_cena.ts)
  if (cena === "mundo") refazerBlocos();
  REM.json = JSON.stringify(ED.dados.removidos || []);
  ORIG.sel.clear();
  UI.base = { s: D3.s, k: dungeon.k, pausado: world.paused };
  UI.zoom = 1;
  world.paused = true;
  CZ.perto = CZ.pertoAlvo = 0;
  dungeon.keys = {};
  dungeon.moveTarget = null;
  document.body.classList.add("ed-on");
  UI.raiz!.hidden = false;
  UI.tela!.hidden = false;
  $("#ed-cena").textContent = NOMES_CENA[cena] || cena;
  medirTopo();
  montarBiblioteca();
  atualizarFerramentas();
  atualizarInspetor();
  atualizarStatus();
  void temServidor().then((s) => {
    aviso(
      s
        ? "Modo ao vivo: o que você fizer é salvo no arquivo do jogo sozinho."
        : "Aberto sem o modo ao vivo: salva no navegador (💾 baixa o arquivo).",
      5000,
    );
    if (s) void sincronizarImportados();
  });
  const r = rascunhoPendente();
  if (r) perguntarRascunho(r);
}
function fecharEditor() {
  if (!ED.on) return;
  if (SALVO.sujo) void salvar(false);
  ED.on = false;
  // e voltam para dentro do cenário: cortar, quebrar, barrar
  if (cenaAtual() === "mundo") refazerBlocos();
  ORIG.sel.clear();
  ORIG.sob = null;
  ED.vendoAntes = false;
  ED.hora = null;
  if (ED.estacao) {
    ED.estacao = "";
    estacaoMudou();
  }
  ED.fantasmas = [];
  ED.selecionados.clear();
  SOB.id = 0;
  fecharRecado();
  UI.arrasto = null;
  UI.teclas.clear();
  D3.s = UI.base.s;
  dungeon.k = UI.base.k;
  world.paused = UI.base.pausado;
  dungeon.keys = {};
  document.body.classList.remove("ed-on");
  UI.raiz!.hidden = true;
  UI.tela!.hidden = true;
  $("#ed-hora-fixa").classList.remove("on");
  for (const b of UI.raiz!.querySelectorAll(".ed-est")) b.classList.remove("on");
}

/* ---------------- a cada quadro (field/chao.ts renderDungeonFrame) ---------------- */
export function editorQuadro(dt: number) {
  if (!ED.on) return;
  if (!dungeon.active || !cenaAtual()) {
    fecharEditor();
    return;
  }
  CZ.perto = CZ.pertoAlvo = 0;
  // andar com a câmera
  const T = UI.teclas,
    ax = (T.has("KeyD") || T.has("ArrowRight") ? 1 : 0) - (T.has("KeyA") || T.has("ArrowLeft") ? 1 : 0),
    az = (T.has("KeyS") || T.has("ArrowDown") ? 1 : 0) - (T.has("KeyW") || T.has("ArrowUp") ? 1 : 0);
  if (ax || az) {
    const v = (EDITOR.pan / UI.zoom) * (T.has("ShiftLeft") || T.has("ShiftRight") ? 2.5 : 1) * dt,
      n = Math.hypot(ax, az);
    D3.cx += (ax / n) * v;
    D3.cz += (az / n) * v;
  }
  // a peça (ou o conjunto) que vai ser posta, sob o cursor
  ED.fantasmas = [];
  if (UI.mouse.naCena && !ED.vendoAntes && (UI.ferramenta === "colocar" || UI.ferramenta === "pincel") && !UI.arrasto) {
    const p = chaoSob(UI.mouse.x, UI.mouse.y);
    if (UI.ferramenta === "colocar" && UI.conjunto)
      ED.fantasmas = (ED.dados.conjuntos[UI.conjunto] || []).map((q) => ({
        ...q,
        pavimento: ED.pavimento,
        x: naGrade(p.x) + q.x,
        z: naGrade(p.z) + q.z,
      }));
    else if (UI.ferramenta === "colocar" && UI.modelo)
      ED.fantasmas = [{ id: -1, m: UI.modelo, x: naGrade(p.x), z: naGrade(p.z), pavimento: ED.pavimento }];
  }
  if (UI.arrasto?.tipo === "card" && UI.arrasto.mexeu && UI.mouse.naCena) {
    const p = chaoSob(UI.mouse.x, UI.mouse.y),
      A = UI.arrasto;
    ED.fantasmas = A.conjunto
      ? (ED.dados.conjuntos[A.conjunto] || []).map((q) => ({ ...q, x: naGrade(p.x) + q.x, z: naGrade(p.z) + q.z }))
      : [{ id: -1, m: A.id, x: naGrade(p.x), z: naGrade(p.z), pavimento: ED.pavimento }];
  }
  desenharTela();
  conferirTerreno(false);
  conferirRemovidos();
  desenharMini();
  if (UI.recado) posicionarRecado();
  const agora = performance.now();
  if (agora - UI.status > 300) {
    UI.status = agora;
    atualizarStatus();
  }
}

/* ---------------- a tela de cima (ícones, alfinetes, grade, caixa, pincel) ---------------- */
function desenharTela() {
  const cv = UI.tela!,
    dpr = window.devicePixelRatio || 1,
    W = innerWidth,
    H = innerHeight;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
  }
  const c = cv.getContext("2d")!;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, W, H);
  const cn = cantoCena();
  // grade
  if (UI.grade) {
    const G = EDITOR.grade,
      a = chaoSob(0, 0),
      b = chaoSob(W, H),
      x0 = Math.floor(Math.min(a.x, b.x) / G) * G,
      x1 = Math.max(a.x, b.x),
      z0 = Math.floor((Math.min(a.z, b.z) - G * 6) / G) * G,
      z1 = Math.max(a.z, b.z) + G * 2;
    if ((x1 - x0) / G < 260 && (z1 - z0) / G < 260) {
      c.strokeStyle = "rgba(255,240,200,.16)";
      c.lineWidth = 1;
      c.beginPath();
      for (let x = x0; x <= x1; x += G) {
        const p = telaDe(x, z0),
          q = telaDe(x, z1);
        c.moveTo(p.x, p.y);
        c.lineTo(q.x, q.y);
      }
      for (let z = z0; z <= z1; z += G) {
        const p = telaDe(x0, z),
          q = telaDe(x1, z);
        c.moveTo(p.x, p.y);
        c.lineTo(q.x, q.y);
      }
      c.stroke();
    }
  }
  galeriaRotulos(c, telaDe);
  // peças invisíveis (luz, efeito, som): ícone e o alcance
  c.textAlign = "center";
  c.textBaseline = "middle";
  const lista = [...pecasLer(), ...ED.fantasmas.filter((f) => invisivel(f.m))];
  for (const p of lista) {
    if (!invisivel(p.m) || ED.camadasOcultas.has(camadaDe(p))) continue;
    const t = telaDe(p.x, p.z, (p.y || 0) + (p.pavimento || 0) * ALTURA_PAVIMENTO),
      sel = ED.selecionados.has(p.id),
      sob = SOB.id === p.id,
      fantasma = p.id === -1 || ED.fantasmas.includes(p),
      info = infoModelo(p.m),
      raio = (p.raio || 0) * D3.s * t.k;
    if (raio > 4 && (sel || sob || fantasma)) {
      c.save();
      c.setLineDash([6, 5]);
      c.strokeStyle = sel ? "rgba(255,206,90,.9)" : "rgba(170,220,255,.7)";
      c.lineWidth = 1.5;
      c.beginPath();
      c.ellipse(t.x, t.y, raio, raio * (D3.SIN || 0.7), 0, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
    c.globalAlpha = fantasma ? 0.6 : 1;
    c.fillStyle = sel ? "rgba(255,200,80,.95)" : sob ? "rgba(255,255,255,.9)" : "rgba(24,18,10,.72)";
    c.beginPath();
    c.arc(t.x, t.y - 12, 13, 0, Math.PI * 2);
    c.fill();
    c.font = "15px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif";
    c.fillText(info?.ico || "•", t.x, t.y - 11);
    c.globalAlpha = 1;
  }
  // alfinetes
  if (!ED.camadasOcultas.has("recados"))
    for (const r of recadosLer()) {
      const t = telaDe(r.x, r.z, 0);
      c.font = "22px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif";
      c.globalAlpha = r.feito ? 0.45 : 1;
      c.fillText(r.feito ? "✅" : "📌", t.x, t.y - 16);
      const txt = r.texto.length > 34 ? r.texto.slice(0, 33) + "…" : r.texto;
      if (txt) {
        c.font = "600 12px Lora, Georgia, serif";
        const w = c.measureText(txt).width + 12;
        c.fillStyle = "rgba(28,20,11,.86)";
        c.fillRect(t.x - w / 2, t.y - 46, w, 18);
        c.fillStyle = r.feito ? "#b9e6a0" : "#ffe9b0";
        c.fillText(txt, t.x, t.y - 37);
      }
      c.globalAlpha = 1;
    }
  // caixa de seleção
  const A = UI.arrasto;
  if (A?.tipo === "caixa") {
    c.fillStyle = "rgba(255,210,122,.12)";
    c.strokeStyle = "rgba(255,210,122,.9)";
    c.lineWidth = 1.2;
    const x = Math.min(A.cx0, A.cx1),
      y = Math.min(A.cy0, A.cy1),
      w = Math.abs(A.cx1 - A.cx0),
      h = Math.abs(A.cy1 - A.cy0);
    c.fillRect(x, y, w, h);
    c.strokeRect(x, y, w, h);
  }
  // pincel (de peças: verde, apagando: vermelho; de terreno: terra marrom, água azul)
  if ((UI.ferramenta === "pincel" || UI.ferramenta === "terreno") && UI.mouse.naCena) {
    const p = chaoSob(UI.mouse.x, UI.mouse.y),
      t = telaDe(p.x, p.z),
      r = UI.pincelRaio * D3.s * t.k,
      shift = UI.teclas.has("ShiftLeft") || UI.teclas.has("ShiftRight"),
      cor =
        UI.ferramenta === "terreno"
          ? modoTerreno(shift) === "agua"
            ? "90,170,255"
            : "205,160,90"
          : shift
            ? "255,110,90"
            : "150,230,140";
    c.strokeStyle = "rgba(" + cor + ",.95)";
    c.fillStyle = "rgba(" + cor + ",.14)";
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(t.x, t.y, r, r * (D3.SIN || 0.7), 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
  // as peças do próprio mapa selecionadas (dourado) e a do cursor (branco): um anel no pé e o contorno da altura
  const anelOrig = (o: PecaMapa, cor: string) => {
    const t = telaDe(o.x, o.z),
      k = D3.s * t.k,
      r = Math.max(7, o.r * k);
    c.strokeStyle = cor;
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(t.x, t.y, r, r * (D3.SIN || 0.7), 0, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([4, 4]);
    c.strokeRect(t.x - r, t.y - altOrig(o) * (D3.COS || 0.7) * k, r * 2, altOrig(o) * (D3.COS || 0.7) * k);
    c.setLineDash([]);
  };
  for (const o of ORIG.sel.values()) anelOrig(o, "rgba(255,206,90,.95)");
  if (ORIG.sob && !ORIG.sel.has(ORIG.sob.id)) anelOrig(ORIG.sob, "rgba(255,255,255,.75)");
  // onde a heroína está
  if (dungeon.hero) {
    const t = telaDe(dungeon.px + cn.x, dungeon.py + cn.y, 0);
    c.font = "600 11px Lora, Georgia, serif";
    c.fillStyle = "rgba(255,226,150,.9)";
    c.fillText("▼ " + dungeon.hero.name, t.x, t.y - 58);
  }
}

/* ---------------- o pincel ---------------- */
function pintar(ax: number, az: number, apagar: boolean) {
  const R = UI.pincelRaio;
  if (apagar) {
    const c = cenaAtual()!,
      antes = pecasLer().length;
    ED.dados.cenas[c] = pecasLer().filter((p) => !editavel(p) || Math.hypot(p.x - ax, p.z - az) > R);
    if (pecasLer().length !== antes) mexeu();
    // e as do próprio mapa (árvores, pedras, mato) debaixo do pincel
    if (origEditavel()) {
      const L = (ED.dados.removidos ||= []),
        n = L.length;
      for (const o of pecasDoMapa(ax - R, az - R, ax + R, az + R))
        if (Math.hypot(o.x - ax, o.z - az) <= R && !L.includes(o.id)) L.push(o.id);
      if (L.length !== n) mexeu();
    }
    return;
  }
  if (!UI.modelo || invisivel(UI.modelo)) return;
  const vs = variantes(UI.modelo).map((m) => m.id),
    grupo = new Set(vs),
    base = malhaModelo(UI.modelo),
    raioPeca = (base?.r || 10) * EDITOR.pincel.espaco * 2,
    L = pecasMudar(),
    tentativas = Math.max(2, Math.round((R * R) / (raioPeca * raioPeca) / 6));
  for (let k = 0; k < tentativas; k++) {
    const a = Math.random() * Math.PI * 2,
      d = Math.sqrt(Math.random()) * R,
      x = ax + Math.cos(a) * d,
      z = az + Math.sin(a) * d,
      e = entre(EDITOR.pincel.variar);
    if (L.some((p) => grupo.has(p.m) && Math.hypot(p.x - x, p.z - z) < raioPeca * Math.max(e, p.e || 1))) continue;
    const m = vs[Math.floor(Math.random() * vs.length)] || UI.modelo,
      p: Deco = { id: novoId(), m, x: r1(x), z: r1(z), g: r3(Math.random() * Math.PI * 2), e: r3(e) };
    L.push(p);
  }
  mexeu();
}

/** A prévia de estação mudou: o cenário é refeito com as cores dela (render/gl/estacao_cor.ts) — no campo aberto os
 *  blocos, nas arenas a cena inteira — e as peças do cenário postas no editor também. */
function estacaoMudou() {
  if (cenaAtual() === "mundo") refazerBlocos();
  else GL3.sceneKey = "";
  esquecerMalhas("cen:");
}

/* ---------------- o pincel de terreno (ilhas, lagos, canais) ---------------- */
/** O modo do pincel de terreno agora (Shift troca terra ↔ água). */
function modoTerreno(shift: boolean) {
  return shift ? (UI.terrenoModo === "terra" ? "agua" : "terra") : UI.terrenoModo;
}
/** Uma pincelada no ponto absoluto do campo (vira unidades do mapa: o terreno é do mapa). */
function tracar(ax: number, az: number, modo: "terra" | "agua") {
  const e = MUNDO.escala;
  (ED.dados.terreno ||= []).push({ t: modo, x: r1(ax * e), y: r1(az * e), r: r1(UI.pincelRaio * e) });
  mexeu();
}
/** O terreno mudou? Refaz a máscara de água, os blocos do campo e os ladrilhos do mapa — só onde mudou quando as
 *  pinceladas só cresceram (pintando), tudo quando não (desfazer, histórico). Pintando, no máximo a cada 250 ms. */
const TERR = { json: "[]", tam: 0, versao: -1, quando: 0 };
/** As peças do mapa apagadas mudaram (apagar, pincel, desfazer)? Refaz só os blocos onde elas estão. */
const REM = { json: "[]", versao: -1, quando: 0 };
function conferirRemovidos() {
  if (ED.versao === REM.versao || performance.now() - REM.quando < 200) return;
  REM.versao = ED.versao;
  REM.quando = performance.now();
  const json = JSON.stringify(ED.dados.removidos || []);
  if (json === REM.json) return;
  const antes = new Set<string>(JSON.parse(REM.json)),
    agora = new Set<string>(JSON.parse(json)),
    T = dungeon.tile;
  REM.json = json;
  let x0 = Infinity,
    z0 = Infinity,
    x1 = -Infinity,
    z1 = -Infinity;
  for (const id of [...antes, ...agora]) {
    if (antes.has(id) && agora.has(id)) continue;
    const m = id.split(":"),
      x = m[0] === "arvore" ? +m[1] / 100 : (+m[1] + 0.5) * T,
      z = m[0] === "arvore" ? +m[2] / 100 : (+m[2] + 0.5) * T;
    x0 = Math.min(x0, x);
    z0 = Math.min(z0, z);
    x1 = Math.max(x1, x);
    z1 = Math.max(z1, z);
  }
  if (x0 <= x1) refazerBlocos({ x0, z0, x1, z1 });
}
function conferirTerreno(agora: boolean) {
  if (ED.versao === TERR.versao) return;
  if (!agora && performance.now() - TERR.quando < 250) return;
  TERR.versao = ED.versao;
  TERR.quando = performance.now();
  const L: Traco[] = ED.dados.terreno || [],
    json = JSON.stringify(L);
  if (json === TERR.json) return;
  // só cresceu: o texto antigo (sem o "]") é o começo do novo
  const cresceu = L.length > TERR.tam && json.startsWith(TERR.json.slice(0, -1)),
    novos = cresceu ? L.slice(TERR.tam) : [];
  TERR.json = json;
  TERR.tam = L.length;
  const e = MUNDO.escala;
  if (cresceu) {
    const x0 = Math.min(...novos.map((t) => t.x - t.r)),
      y0 = Math.min(...novos.map((t) => t.y - t.r)),
      x1 = Math.max(...novos.map((t) => t.x + t.r)),
      y1 = Math.max(...novos.map((t) => t.y + t.r));
    terrenoMudou({ x0, y0, x1, y1 });
    refazerBlocos({ x0: x0 / e, z0: y0 / e, x1: x1 / e, z1: y1 / e });
  } else {
    terrenoMudou();
    refazerBlocos();
  }
  mapaTerrenoMudou();
  MINI.base = null;
}

/* ---------------- o mini mapa (M) ---------------- */
const MINI = { base: null as HTMLCanvasElement | null, cena: "", ultimo: 0, lado: 230 };
/** A imagem do mapa inteiro (mar, terra pela costa e o terreno pintado) no tamanho do mini mapa. */
function miniBase(W: number, H: number) {
  if (MINI.base && MINI.base.width === W && MINI.base.height === H) return MINI.base;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d")!,
    k = W / TELAS.worldW;
  c.fillStyle = "#3d6f86";
  c.fillRect(0, 0, W, H);
  if (MAPART.ready && MAPART.sea && MAPART.land) {
    c.drawImage(MAPART.sea, 0, 0, W, H);
    c.save();
    c.setTransform(k, 0, 0, k, 0, 0);
    c.clip(MAPART.coast, "evenodd");
    c.drawImage(MAPART.land, 0, 0, TELAS.worldW, TELAS.worldH);
    c.restore();
  }
  c.save();
  c.setTransform(k, 0, 0, k, 0, 0);
  for (const t of ED.dados.terreno || []) {
    c.fillStyle = t.t === "terra" ? "#8fae5a" : "#4f8fb0";
    c.beginPath();
    c.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
  return (MINI.base = cv);
}
/** O retângulo do mundo que o mini mapa mostra e a escala: o mapa inteiro no campo aberto, a arena nas outras cenas
 *  (em px do campo absolutos, os mesmos das peças). */
function miniQuadro() {
  const e = MUNDO.escala,
    d = dungeon;
  if (cenaAtual() === "mundo" && TELAS.worldW) return { x0: 0, z0: 0, w: TELAS.worldW / e, h: TELAS.worldH / e };
  return { x0: 0, z0: 0, w: d.cols * d.tile, h: d.rows * d.tile };
}
function desenharMini() {
  const cv = $<HTMLCanvasElement>("#ed-mini-cv"),
    box = $("#ed-mini");
  box.hidden = !UI.mini;
  if (!UI.mini) return;
  const agora = performance.now();
  if (agora - MINI.ultimo < 90 && !UI.arrasto) return;
  MINI.ultimo = agora;
  const Q = miniQuadro(),
    L = MINI.lado,
    W = Q.w >= Q.h ? L : Math.round((L * Q.w) / Q.h),
    H = Q.w >= Q.h ? Math.round((L * Q.h) / Q.w) : L;
  if (cv.width !== W || cv.height !== H) {
    cv.width = W;
    cv.height = H;
  }
  const c = cv.getContext("2d")!,
    k = W / Q.w,
    mundo = cenaAtual() === "mundo";
  if (mundo) c.drawImage(miniBase(W, H), 0, 0);
  else {
    c.fillStyle = "#3b4a2c";
    c.fillRect(0, 0, W, H);
  }
  // as peças postas (pontinhos) e os recados
  const cn = cantoCena(),
    off = mundo ? { x: 0, y: 0 } : cn;
  c.fillStyle = "rgba(255,226,150,.85)";
  for (const p of pecasLer()) c.fillRect((p.x - off.x) * k - 1, (p.z - off.y) * k - 1, 2, 2);
  c.fillStyle = "#ff6a4a";
  for (const r of recadosLer()) {
    c.beginPath();
    c.arc((r.x - off.x) * k, (r.z - off.y) * k, 3, 0, Math.PI * 2);
    c.fill();
  }
  // a heroína
  const hx = (dungeon.px + cn.x - off.x) * k,
    hz = (dungeon.py + cn.y - off.y) * k;
  c.fillStyle = "#ffd27a";
  c.strokeStyle = "#1c140b";
  c.beginPath();
  c.arc(hx, hz, 4, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // o que a câmera vê
  const r = TELAS.dCanvas.getBoundingClientRect(),
    a = chaoSob(r.left, r.top),
    b = chaoSob(r.right, r.bottom);
  c.strokeStyle = "#fff";
  c.lineWidth = 1.5;
  c.strokeRect((a.x - off.x) * k, (a.z - off.y) * k, Math.max(3, (b.x - a.x) * k), Math.max(3, (b.z - a.z) * k));
}
/** Leva a câmera ao ponto do mini mapa sob o cursor. */
function miniIr(px: number, py: number) {
  const cv = $<HTMLCanvasElement>("#ed-mini-cv"),
    rr = cv.getBoundingClientRect(),
    Q = miniQuadro(),
    x = ((px - rr.left) / rr.width) * Q.w,
    z = ((py - rr.top) / rr.height) * Q.h,
    cn = cantoCena(),
    mundo = cenaAtual() === "mundo";
  D3.cx = mundo ? x - cn.x : x;
  D3.cz = mundo ? z - cn.y : z;
  MINI.ultimo = 0;
}
function alternarMini() {
  UI.mini = !UI.mini;
  guardarPrefs();
  atualizarFerramentas();
}

/* ---------------- mouse e teclado ---------------- */
function naCena(e: Event) {
  const w = document.getElementById("dungeon-stage-wrap");
  return !!w && e.target instanceof Node && w.contains(e.target);
}
function noPainel(e: Event) {
  return !!UI.raiz && e.target instanceof Node && UI.raiz.contains(e.target);
}
function aoApertar(e: PointerEvent) {
  if (!ED.on) return;
  if (noPainel(e)) return;
  if (!naCena(e)) return;
  e.stopPropagation();
  e.preventDefault();
  fecharRecadoSeFora(e);
  // O clique na cena assume os atalhos, mesmo após editar a busca ou o inspetor.
  const foco = document.activeElement;
  if (foco instanceof HTMLElement && UI.raiz?.contains(foco)) foco.blur();
  const P = chaoSob(e.clientX, e.clientY);
  if (e.button === 1 || e.button === 2) {
    UI.arrasto = {
      tipo: "camera",
      cx0: e.clientX,
      cy0: e.clientY,
      camX: D3.cx,
      camZ: D3.cz,
      mexeu: false,
      peca: e.button === 2 ? pecaSob(e.clientX, e.clientY) : null,
    };
    return;
  }
  if (e.button !== 0) return;
  const rec = recadoSob(e.clientX, e.clientY);
  if (rec) {
    abrirRecado(rec);
    return;
  }
  if (UI.ferramenta === "recado") {
    if (bloqueado()) return;
    const r: Recado = { id: novoId(), x: r1(P.x), z: r1(P.z), texto: "", quando: new Date().toISOString() };
    mudar(() => (ED.dados.recados[cenaAtual()!] ||= []).push(r));
    abrirRecado(r, true);
    return;
  }
  if (UI.ferramenta === "colocar" && (UI.modelo || UI.conjunto)) {
    colocarEm(P.x, P.z);
    return;
  }
  if (UI.ferramenta === "pincel") {
    if (bloqueado()) return;
    const apagar = e.shiftKey;
    abrirMudanca();
    pintar(P.x, P.z, apagar);
    UI.arrasto = { tipo: "pincel", ux: P.x, uz: P.z, apagar };
    return;
  }
  if (UI.ferramenta === "terreno") {
    if (bloqueado()) return;
    if (cenaAtual() !== "mundo") {
      aviso("O pincel de terreno é do campo aberto (o mapa). Aqui não tem mar nem ilha para pintar.");
      return;
    }
    const modo = modoTerreno(e.shiftKey);
    abrirMudanca();
    tracar(P.x, P.z, modo);
    UI.arrasto = { tipo: "terreno", ux: P.x, uz: P.z, modo };
    return;
  }
  const p = pecaSob(e.clientX, e.clientY);
  if (p) {
    if (e.shiftKey) {
      if (ED.selecionados.has(p.id)) ED.selecionados.delete(p.id);
      else ED.selecionados.add(p.id);
      atualizarInspetor();
      return;
    }
    if (!ED.selecionados.has(p.id)) selecionar([p.id]);
    if (bloqueado()) return;
    const orig = new Map<number, [number, number]>();
    for (const q of selecionadas()) orig.set(q.id, [q.x, q.z]);
    UI.arrasto = {
      tipo: "mover",
      x0: P.x,
      z0: P.z,
      cx0: e.clientX,
      cy0: e.clientY,
      orig,
      mexeu: false,
      copiar: e.altKey,
    };
    return;
  }
  // uma árvore, pedra ou moita do próprio mapa: seleciona (Delete apaga)
  const o = originalSob(e.clientX, e.clientY);
  if (o) {
    if (!e.shiftKey) selecionar([]);
    if (e.shiftKey && ORIG.sel.has(o.id)) ORIG.sel.delete(o.id);
    else ORIG.sel.set(o.id, o);
    atualizarInspetor();
    return;
  }
  UI.arrasto = { tipo: "caixa", cx0: e.clientX, cy0: e.clientY, cx1: e.clientX, cy1: e.clientY, somar: e.shiftKey };
}
function aoMover(e: PointerEvent) {
  if (!ED.on) return;
  UI.mouse.x = e.clientX;
  UI.mouse.y = e.clientY;
  UI.mouse.naCena = naCena(e) && !noPainel(e);
  const A = UI.arrasto;
  if (!A) {
    const p = UI.mouse.naCena && UI.ferramenta === "mover" ? pecaSob(e.clientX, e.clientY) : null;
    SOB.id = p ? p.id : 0;
    ORIG.sob = !p && UI.mouse.naCena && UI.ferramenta === "mover" ? originalSob(e.clientX, e.clientY) : null;
    return;
  }
  e.stopPropagation();
  if (A.tipo === "camera") {
    const dx = e.clientX - A.cx0,
      dy = e.clientY - A.cy0,
      k = telaDe(0, 0).k * D3.s;
    if (Math.abs(dx) + Math.abs(dy) > 3) A.mexeu = true;
    D3.cx = A.camX - dx / k;
    D3.cz = A.camZ - dy / (k * (D3.SIN || 0.7));
  } else if (A.tipo === "mover") {
    if (!A.mexeu && Math.hypot(e.clientX - A.cx0, e.clientY - A.cy0) < 4) return;
    if (!A.mexeu) {
      A.mexeu = true;
      abrirMudanca();
      if (A.copiar) {
        // Alt+arrastar: as cópias ficam no lugar, as selecionadas (originais) é que andam — o efeito é o mesmo
        for (const q of selecionadas()) pecasMudar().push({ ...q, id: novoId() });
      }
    }
    const P = chaoSob(e.clientX, e.clientY),
      dx = P.x - A.x0,
      dz = P.z - A.z0;
    for (const q of selecionadas()) {
      const o = A.orig.get(q.id);
      if (!o) continue;
      q.x = r1(naGrade(o[0] + dx));
      q.z = r1(naGrade(o[1] + dz));
    }
    mexeu();
  } else if (A.tipo === "caixa") {
    A.cx1 = e.clientX;
    A.cy1 = e.clientY;
  } else if (A.tipo === "pincel") {
    const P = chaoSob(e.clientX, e.clientY);
    if (Math.hypot(P.x - A.ux, P.z - A.uz) > UI.pincelRaio * 0.35) {
      A.ux = P.x;
      A.uz = P.z;
      pintar(P.x, P.z, A.apagar);
    }
  } else if (A.tipo === "terreno") {
    const P = chaoSob(e.clientX, e.clientY),
      d = Math.hypot(P.x - A.ux, P.z - A.uz),
      passo = UI.pincelRaio * 0.3;
    // pinceladas a cada 30% do raio, preenchendo o caminho (o mouse rápido não deixa buracos)
    for (let k = 1; d > passo && k * passo <= d; k++)
      tracar(A.ux + ((P.x - A.ux) * k * passo) / d, A.uz + ((P.z - A.uz) * k * passo) / d, A.modo);
    if (d > passo) {
      A.ux = P.x;
      A.uz = P.z;
    }
  } else if (A.tipo === "mini") {
    miniIr(e.clientX, e.clientY);
  } else if (A.tipo === "card") {
    if (Math.hypot(e.clientX - A.cx0, e.clientY - A.cy0) > 6) A.mexeu = true;
  }
}
function aoSoltar(e: PointerEvent) {
  if (!ED.on) return;
  if (naCena(e) && !noPainel(e)) e.stopPropagation(); // o jogo não vê o soltar (soltar a flecha, o golpe…)
  const A = UI.arrasto;
  if (!A) return;
  UI.arrasto = null;
  if (A.tipo === "mover") {
    if (A.mexeu) {
      fecharMudanca();
      atualizarInspetor(true);
    }
  } else if (A.tipo === "pincel") fecharMudanca();
  else if (A.tipo === "terreno") {
    fecharMudanca();
    conferirTerreno(true);
  } else if (A.tipo === "caixa") {
    const x0 = Math.min(A.cx0, A.cx1),
      x1 = Math.max(A.cx0, A.cx1),
      y0 = Math.min(A.cy0, A.cy1),
      y1 = Math.max(A.cy0, A.cy1);
    if (x1 - x0 < 4 && y1 - y0 < 4) {
      if (!A.somar) selecionar([]);
      return;
    }
    const ids = pecasLer()
      .filter((p) => {
        if (!editavel(p)) return false;
  const t = telaDe(p.x, p.z, (p.y || 0) + (p.pavimento || 0) * ALTURA_PAVIMENTO);
        return t.x >= x0 && t.x <= x1 && t.y >= y0 && t.y <= y1;
      })
      .map((p) => p.id);
    selecionar(ids, A.somar);
    // e as do próprio mapa dentro da caixa (para limpar um pedaço de floresta)
    if (origEditavel()) {
      const a = chaoSob(x0, y0),
        b = chaoSob(x1, y1);
      for (const o of pecasDoMapa(a.x, a.z, b.x, b.z + 60)) {
        const t = telaDe(o.x, o.z);
        if (t.x >= x0 && t.x <= x1 && t.y >= y0 && t.y <= y1) ORIG.sel.set(o.id, o);
      }
      atualizarInspetor();
    }
  } else if (A.tipo === "camera") {
    if (!A.mexeu && A.peca && e.button === 2) {
      selecionar([A.peca.id]);
      UI.ferramenta = "mover";
      atualizarFerramentas();
    } else if (!A.mexeu && e.button === 2 && UI.ferramenta !== "mover") {
      UI.ferramenta = "mover";
      atualizarFerramentas();
    }
  } else if (A.tipo === "card") {
    if (A.mexeu && naCena(e) && !noPainel(e)) {
      const P = chaoSob(e.clientX, e.clientY);
      const antes = { m: UI.modelo, c: UI.conjunto };
      UI.modelo = A.conjunto ? null : A.id;
      UI.conjunto = A.conjunto;
      colocarEm(P.x, P.z);
      UI.modelo = antes.m || UI.modelo;
      UI.conjunto = antes.c;
    } else if (!A.mexeu) escolherModelo(A.conjunto ? null : A.id, A.conjunto);
  }
}
function aoRolar(e: WheelEvent) {
  if (!ED.on || noPainel(e) || !naCena(e)) return;
  e.preventDefault();
  e.stopPropagation();
  const sobe = e.deltaY < 0;
  if (UI.ferramenta === "pincel" && (e.altKey || e.ctrlKey)) {
    UI.pincelRaio = Math.max(
      EDITOR.pincel.raioMin,
      Math.min(EDITOR.pincel.raioMax, UI.pincelRaio * (sobe ? 1.12 : 1 / 1.12)),
    );
    sincronizarPincel();
    return;
  }
  if (ED.selecionados.size && !e.ctrlKey && UI.ferramenta === "mover") {
    if (e.shiftKey) escalar(sobe ? EDITOR.escala : 1 / EDITOR.escala);
    else girar(sobe ? EDITOR.giro : -EDITOR.giro);
    return;
  }
  // zoom no ponto do cursor
  const antes = chaoSob(e.clientX, e.clientY),
    z = Math.max(
      EDITOR.zoom.min,
      Math.min(EDITOR.zoom.max, UI.zoom * (sobe ? EDITOR.zoom.passo : 1 / EDITOR.zoom.passo)),
    );
  if (z === UI.zoom) return;
  UI.zoom = z;
  D3.s = UI.base.s * z;
  dungeon.k = D3.s * (D3.dpr || 1);
  const depois = chaoSob(e.clientX, e.clientY);
  D3.cx += antes.x - depois.x;
  D3.cz += antes.z - depois.z;
}
function digitando(e: Event) {
  const t = e.target as HTMLElement | null;
  return !!t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
}
/** F2 / Ctrl+Shift+E / o botão: no campo abre na hora; no mapa leva a personagem selecionada (ou a primeira) para o
 *  campo aberto e abre quando a cena estiver pronta; senão avisa o que fazer. */
function pedirEditor() {
  if (ED.on) return;
  const titulo = document.getElementById("title-screen");
  if (titulo && titulo.offsetParent !== null && getComputedStyle(titulo).display !== "none") {
    mvToast("🛠 Comece ou continue um jogo primeiro; o editor abre no campo.");
    return;
  }
  if (dungeon.active) {
    if (cenaAtual()) abrirEditor();
    else mvToast("🛠 O editor abre no campo aberto, na vila, no acampamento ou na sala de treino.");
    return;
  }
  const h = SEL.selectedHero || world.heroes[0] || null;
  if (!h) {
    mvToast("🛠 Crie uma personagem primeiro; o editor abre no campo.");
    return;
  }
  mvToast("🛠 Indo para o campo com " + h.name + "… o editor abre em seguida.");
  h.state = "idle";
  h.task = null;
  h.walkTo = null;
  JOGO.pending = true;
  JOGO.pos = { x: h.x, y: h.y };
  launchDungeon(h.id, true);
  const t0 = performance.now(),
    espera = setInterval(() => {
      if (dungeon.active && cenaAtual() && D3.gl) {
        clearInterval(espera);
        setTimeout(abrirEditor, 700);
      } else if (performance.now() - t0 > 12000) {
        clearInterval(espera);
        mvToast("🛠 Não consegui entrar no campo. Entre com a heroína e aperte F2.");
      }
    }, 200);
}
function aoTeclar(e: KeyboardEvent) {
  if (!ED.on) {
    if (e.code === "F2" || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "KeyE")) {
      e.preventDefault();
      e.stopImmediatePropagation();
      pedirEditor();
    }
    return;
  }
  if (digitando(e) && noPainel(e)) {
    if (e.code === "Escape") (e.target as HTMLElement).blur();
    return; // a raiz do editor segura a tecla (não chega no jogo)
  }
  e.stopImmediatePropagation();
  const k = e.code,
    ctrl = e.ctrlKey || e.metaKey;
  UI.teclas.add(k);
  let usou = true;
  if (k === "F2") fecharEditor();
  else if (ctrl && k === "KeyZ" && !e.shiftKey) {
    if (desfazer()) aviso("Desfeito");
    atualizarInspetor();
  } else if (ctrl && (k === "KeyY" || (k === "KeyZ" && e.shiftKey))) {
    if (refazer()) aviso("Refeito");
    atualizarInspetor();
  } else if (ctrl && k === "KeyS") void salvar(true);
  else if (ctrl && k === "KeyD") duplicar();
  else if (ctrl && k === "KeyC") copiar();
  else if (ctrl && k === "KeyV") colar();
  else if (ctrl && k === "KeyA")
    selecionar(
      pecasLer()
        .filter(editavel)
        .map((p) => p.id),
    );
  else if (k === "Delete" || k === "Backspace") apagarSelecionados();
  else if (k === "Escape") {
    if (UI.recado) fecharRecado();
    else if (UI.ferramenta !== "mover") {
      UI.ferramenta = "mover";
      atualizarFerramentas();
    } else selecionar([]);
  } else if (k === "KeyQ") girar(-EDITOR.giro);
  else if (k === "KeyE") girar(EDITOR.giro);
  else if (k === "KeyR") ajustar((p) => (p.g = 0));
  else if (k === "Equal" || k === "NumpadAdd") escalar(EDITOR.escala);
  else if (k === "Minus" || k === "NumpadSubtract") escalar(1 / EDITOR.escala);
  else if (k === "PageUp") subir(2);
  else if (k === "PageDown") subir(-2);
  else if (k === "KeyG") alternarGrade();
  else if (k === "KeyH") alternarPaineis();
  else if (k === "KeyT") testarAqui();
  else if (k === "KeyV") usarFerramenta("mover");
  else if (k === "KeyP") usarFerramenta("pincel");
  else if (k === "KeyN") usarFerramenta("recado");
  else if (k === "KeyI") usarFerramenta("terreno");
  else if (k === "KeyM") alternarMini();
  else if (k === "BracketLeft") mudarPincel(1 / 1.2);
  else if (k === "BracketRight") mudarPincel(1.2);
  else if (k === "Home") {
    D3.cx = dungeon.px;
    D3.cz = dungeon.py;
  } else if (k === "Space") verAntes(true);
  else if (!/^(Key[WASD]|Arrow|Shift)/.test(k)) usou = false;
  if (usou) e.preventDefault();
}
function aoSoltarTecla(e: KeyboardEvent) {
  if (!ED.on) return;
  UI.teclas.delete(e.code);
  if (digitando(e) && noPainel(e)) return;
  e.stopImmediatePropagation();
  if (e.code === "Space") verAntes(false);
}
function mudarPincel(k: number) {
  UI.pincelRaio = Math.max(EDITOR.pincel.raioMin, Math.min(EDITOR.pincel.raioMax, UI.pincelRaio * k));
  sincronizarPincel();
}
function verAntes(sim: boolean) {
  if (sim && !ED.antes) return;
  if (ED.vendoAntes === sim) return;
  ED.vendoAntes = sim;
  ED.versao++;
  $("#ed-antes").classList.toggle("on", sim);
  UI.raiz!.classList.toggle("ed-vendo-antes", sim);
}

/* ---------------- a interface ---------------- */
function montarUI() {
  const raiz = document.createElement("div");
  raiz.id = "ed-raiz";
  raiz.hidden = true;
  raiz.innerHTML = `
<div id="ed-topo" class="ed-painel">
  <b class="ed-titulo">🛠 Modo Editor</b><span id="ed-cena" class="ed-cena"></span>
  <span class="ed-grupo">
    <button data-f="mover" title="Mover e selecionar (V)">🖱 Mover</button>
    <button data-f="colocar" title="Colocar a peça escolhida na biblioteca">➕ Colocar</button>
    <button data-f="pincel" title="Pincel: pinta várias peças (P) · Shift apaga · [ ] tamanho">🖌 Pincel</button>
    <button data-f="terreno" title="Pincel de terreno (I): pinta terra (ilhas) ou água (lagos, rios) · Shift troca">⛰ Terreno</button>
    <button data-f="recado" title="Recado para o Claude (N)">📌 Recado</button>
  </span>
  <span class="ed-grupo">
    <button id="ed-desfazer" title="Desfazer (Ctrl+Z)">↶</button><button id="ed-refazer" title="Refazer (Ctrl+Y)">↷</button>
    <button id="ed-grade" title="Grade com ímã (G)"># Grade</button>
    <label class="ed-pav-label">Pavimento <select id="ed-pavimento"><option value="0">Térreo</option><option value="1">Segundo andar</option></select></label>
    <button id="ed-exportar" title="Exportar esta construção em JSON">⇩ Exportar</button><button id="ed-importar" title="Importar construção JSON">⇧ Importar</button>
    <button id="ed-mini-bt" title="Mini mapa (M)">🗺 Mapa</button>
    <button id="ed-variar" title="Peças novas com giro e tamanho sorteados">🎲 Variar</button>
  </span>
  <span class="ed-grupo ed-atmos">
    <button id="ed-hora-fixa" title="Fixar a hora do dia (só no editor)">🕐</button><input id="ed-hora" type="range" min="0" max="24" step="0.25" value="12" title="Hora do dia"><span id="ed-hora-txt">12:00</span>
    ${Object.entries(ESTACOES)
      .map(
        ([k, v]) =>
          `<button class="ed-est" data-est="${k}" title="Prévia: ${v.nome}"><img src="${v.img}" alt="${v.ico}"></button>`,
      )
      .join("")}
  </span>
  <span class="ed-grupo">
    <button id="ed-antes" title="Segure (ou Espaço) para ver como estava na última vez que salvou">⇆ Antes/Depois</button>
    <button id="ed-hist" title="Versões antigas salvas">🕘 Histórico</button>
    <button id="ed-ap-bt" title="Aparências: ver e marcar todas as combinações de corpo e cabeça">👤 Aparências</button>
  </span>
  <span class="ed-grupo ed-dir">
    <button id="ed-ajuda" title="Como usar o editor">❓</button>
    <button id="ed-testar" title="Jogar aqui (T): a heroína aparece onde o mouse está">▶ Testar aqui</button>
    <button id="ed-salvar" title="Salvar agora (Ctrl+S)">💾 Salvar</button>
    <button id="ed-sair" title="Sair do editor (F2)">✕</button>
  </span>
</div>
<div id="ed-bib" class="ed-painel">
  <div class="ed-bib-topo"><b>Biblioteca</b><input id="ed-busca" type="search" placeholder="🔍 buscar…"></div>
  <div id="ed-cats"></div>
  <div id="ed-cards"></div>
  <div id="ed-pincel-op"><div id="ed-terreno-op"><button data-tm="terra" title="Pinta terra: ilhas, aterros, pontes de terra">🟫 Terra</button><button data-tm="agua" title="Pinta água: lagos, rios, canais">🌊 Água</button></div><label>🖌 Tamanho <input id="ed-pincel" type="range" min="${EDITOR.pincel.raioMin}" max="${EDITOR.pincel.raioMax}" value="${EDITOR.pincel.raio}"></label></div>
  <div id="ed-dica-pasta"></div>
</div>
<div id="ed-lado" class="ed-painel">
  <div id="ed-insp"></div>
  <details id="ed-camadas-box" open><summary>Camadas</summary><div id="ed-camadas"></div></details>
  <details id="ed-recados-box" open><summary>Recados para o Claude <span id="ed-nrec"></span></summary><div id="ed-recados"></div></details>
</div>
<div id="ed-mini" class="ed-painel" hidden><div class="ed-mini-topo"><b>🗺 Mapa</b><button id="ed-mini-x" title="Fechar (M)">✕</button></div><canvas id="ed-mini-cv"></canvas></div>
<div id="ed-status" class="ed-painel"><span id="ed-dica"></span><span id="ed-salvo"></span></div>
<div id="ed-faixa-antes">Vendo: ANTES (a última versão salva) · solte para voltar</div>
<div id="ed-modal" hidden></div>`;
  document.body.appendChild(raiz);
  UI.raiz = raiz;
  const tela = document.createElement("canvas");
  tela.id = "ed-tela";
  tela.hidden = true;
  document.body.appendChild(tela);
  UI.tela = tela;
  // teclas digitadas nos campos do editor não chegam no jogo
  for (const t of ["keydown", "keyup", "keypress"]) raiz.addEventListener(t, (e) => e.stopPropagation());
  raiz.addEventListener("wheel", (e) => e.stopPropagation(), { passive: true });
  raiz.addEventListener("contextmenu", (e) => e.stopPropagation());
  for (const b of raiz.querySelectorAll<HTMLButtonElement>("[data-f]"))
    b.onclick = () => usarFerramenta(b.dataset.f as Ferramenta);
  $("#ed-desfazer").onclick = () => {
    desfazer();
    atualizarInspetor();
  };
  $("#ed-refazer").onclick = () => {
    refazer();
    atualizarInspetor();
  };
  $("#ed-grade").onclick = alternarGrade;
  const pavimento = $<HTMLSelectElement>("#ed-pavimento");
  pavimento.value = String(ED.pavimento);
  pavimento.onchange = () => {
    ED.pavimento = +pavimento.value;
    selecionar([]);
    atualizarInspetor();
    aviso(ED.pavimento ? "Editando o segundo andar · altura +84" : "Editando o térreo");
  };
  $("#ed-exportar").onclick = exportarConstrucao;
  $("#ed-importar").onclick = importarConstrucao;
  $("#ed-mini-bt").onclick = $("#ed-mini-x").onclick = alternarMini;
  $("#ed-mini-cv").onpointerdown = (e) => {
    e.preventDefault();
    UI.arrasto = { tipo: "mini" };
    miniIr(e.clientX, e.clientY);
  };
  for (const b of raiz.querySelectorAll<HTMLButtonElement>("[data-tm]"))
    b.onclick = () => {
      UI.terrenoModo = b.dataset.tm as "terra" | "agua";
      atualizarFerramentas();
    };
  $("#ed-variar").onclick = () => {
    UI.variar = !UI.variar;
    guardarPrefs();
    atualizarFerramentas();
  };
  const hora = $<HTMLInputElement>("#ed-hora");
  hora.oninput = () => {
    ED.hora = +hora.value;
    $("#ed-hora-fixa").classList.add("on");
    $("#ed-hora-txt").textContent = textoHora(ED.hora);
  };
  $("#ed-hora-fixa").onclick = () => {
    if (ED.hora == null) ED.hora = +hora.value;
    else ED.hora = null;
    $("#ed-hora-fixa").classList.toggle("on", ED.hora != null);
  };
  for (const b of raiz.querySelectorAll<HTMLButtonElement>(".ed-est"))
    b.onclick = () => {
      ED.estacao = ED.estacao === b.dataset.est ? "" : b.dataset.est!;
      estacaoMudou();
      for (const o of raiz.querySelectorAll(".ed-est"))
        o.classList.toggle("on", (o as HTMLElement).dataset.est === ED.estacao);
      aviso(
        ED.estacao
          ? "Prévia: " + ESTACOES[ED.estacao].nome + " (só no editor, o jogo continua igual)"
          : "Estação: a de sempre",
      );
    };
  const antes = $("#ed-antes");
  antes.onpointerdown = () => verAntes(true);
  antes.onpointerup = antes.onpointerleave = () => verAntes(false);
  $("#ed-hist").onclick = () => void abrirHistorico();
  $("#ed-ap-bt").onclick = () => {
    alternarAparencias(UI.raiz!, centroCamera(), (t) => aviso(t), cantoCena);
    $("#ed-ap-bt").classList.toggle("on", !document.getElementById("ed-ap")?.hidden);
  };
  $("#ed-ajuda").onclick = abrirAjuda;
  $("#ed-testar").onclick = testarAqui;
  $("#ed-salvar").onclick = () => void salvar(true);
  $("#ed-sair").onclick = fecharEditor;
  const busca = $<HTMLInputElement>("#ed-busca");
  busca.oninput = () => {
    UI.busca = busca.value.trim().toLowerCase();
    montarCards();
  };
  const pincel = $<HTMLInputElement>("#ed-pincel");
  pincel.oninput = () => {
    UI.pincelRaio = +pincel.value;
  };
  SALVO.aoMudar = atualizarStatus;
  lerPrefs();
  atualizarFerramentas();
}
/** Os painéis do lado começam abaixo da barra de cima (que quebra em duas linhas em tela estreita). */
function medirTopo() {
  const t = $("#ed-topo");
  UI.raiz!.style.setProperty("--ed-topo", Math.round(t.offsetTop + t.offsetHeight + 8) + "px");
}
function textoHora(h: number) {
  return String(Math.floor(h) % 24).padStart(2, "0") + ":" + String(Math.round((h % 1) * 60)).padStart(2, "0");
}
function usarFerramenta(f: Ferramenta) {
  UI.ferramenta = f;
  if (f === "colocar" && !UI.modelo && !UI.conjunto) aviso("Escolha uma peça na biblioteca à esquerda.");
  if (f === "pincel" && (!UI.modelo || invisivel(UI.modelo)))
    aviso("Escolha uma planta, árvore ou pedra na biblioteca para pintar.");
  if (f === "recado") aviso("Clique no chão onde quer o recado.");
  if (f === "terreno")
    aviso(
      cenaAtual() === "mundo"
        ? "Pincel de terreno: 🟫 Terra faz ilhas, 🌊 Água faz lagos e rios (Shift troca). O mapa muda junto."
        : "O pincel de terreno é do campo aberto (o mapa).",
    );
  atualizarFerramentas();
}
function alternarGrade() {
  UI.grade = !UI.grade;
  guardarPrefs();
  atualizarFerramentas();
}
function alternarPaineis() {
  UI.paineis = !UI.paineis;
  UI.raiz!.classList.toggle("ed-sem-paineis", !UI.paineis);
}
function atualizarFerramentas() {
  if (!UI.raiz) return;
  for (const b of UI.raiz.querySelectorAll<HTMLElement>("[data-f]"))
    b.classList.toggle("on", b.dataset.f === UI.ferramenta);
  $("#ed-grade").classList.toggle("on", UI.grade);
  $("#ed-variar").classList.toggle("on", UI.variar);
  $("#ed-pincel-op").hidden = UI.ferramenta !== "pincel" && UI.ferramenta !== "terreno";
  $("#ed-terreno-op").hidden = UI.ferramenta !== "terreno";
  for (const b of UI.raiz.querySelectorAll<HTMLElement>("[data-tm]"))
    b.classList.toggle("on", b.dataset.tm === UI.terrenoModo);
  $("#ed-mini-bt").classList.toggle("on", UI.mini);
  UI.raiz.dataset.ferramenta = UI.ferramenta;
}
function sincronizarPincel() {
  if (UI.raiz) $<HTMLInputElement>("#ed-pincel").value = String(Math.round(UI.pincelRaio));
}
function escolherModelo(id: string | null, conjunto: string | null = null) {
  UI.modelo = id;
  UI.conjunto = conjunto;
  if (UI.ferramenta !== "pincel" || !id || invisivel(id) || conjunto) UI.ferramenta = "colocar";
  atualizarFerramentas();
  montarCards();
}

/* biblioteca */
function montarBiblioteca() {
  const cats = $("#ed-cats"),
    lista = [
      ...CATEGORIAS.map((c) => ({ id: c.id, nome: c.nome, ico: c.ico })),
      { id: "conjuntos", nome: "Conjuntos", ico: "🧩" },
    ];
  cats.innerHTML = lista
    .map(
      (c) =>
        `<button data-cat="${c.id}" class="${c.id === UI.cat ? "on" : ""}" title="${c.nome}">${c.ico}<small>${c.nome}</small></button>`,
    )
    .join("");
  for (const b of cats.querySelectorAll<HTMLButtonElement>("button"))
    b.onclick = () => {
      UI.cat = b.dataset.cat!;
      guardarPrefs();
      montarBiblioteca();
    };
  montarCards();
}
function montarCards() {
  const box = $("#ed-cards"),
    busca = UI.busca;
  box.innerHTML = "";
  const dica = $("#ed-dica-pasta");
  dica.innerHTML =
    UI.cat === "importados"
      ? `Para trazer um modelo novo: jogue o arquivo <b>.glb</b> na pasta <code>modelos-novos</code> do projeto (com o modo ao vivo aberto). Ele aparece aqui sozinho em alguns segundos.`
      : UI.cat === "conjuntos"
        ? "Selecione várias peças e use “Salvar conjunto” no painel da direita."
        : "";
  if (UI.cat === "conjuntos") {
    for (const [nome, pecas] of Object.entries(ED.dados.conjuntos)) {
      if (busca && !nome.toLowerCase().includes(busca)) continue;
      const card = document.createElement("div");
      card.className = "ed-card" + (UI.conjunto === nome ? " on" : "");
      card.innerHTML = `<i class="ed-ico">🧩</i><span>${esc(nome)}<small> · ${pecas.length}</small></span><b class="ed-x" title="Apagar o conjunto">×</b>`;
      prenderCard(card, nome, nome);
      card.querySelector<HTMLElement>(".ed-x")!.onpointerdown = (ev) => {
        ev.stopPropagation();
        if (!confirm("Apagar o conjunto “" + nome + "”? (as peças já postas ficam)")) return;
        mudar(() => delete ED.dados.conjuntos[nome]);
        if (UI.conjunto === nome) UI.conjunto = null;
        montarCards();
      };
      box.appendChild(card);
    }
    if (!box.children.length) box.innerHTML = `<p class="ed-vazio">Nenhum conjunto ainda.</p>`;
    return;
  }
  const ms = listarModelos().filter((m) =>
    busca ? m.nome.toLowerCase().includes(busca) || m.id.includes(busca) : m.cat === UI.cat,
  );
  for (const m of ms) {
    const card = document.createElement("div");
    card.className = "ed-card" + (UI.modelo === m.id && !UI.conjunto ? " on" : "");
    card.title = m.nome;
    card.innerHTML = m.ico
      ? `<i class="ed-ico">${m.ico}</i><span>${esc(m.nome)}</span>`
      : `<img alt=""><span>${esc(m.nome)}</span>`;
    const img = card.querySelector("img");
    if (img)
      void miniatura(m.id).then((u) => {
        if (u) img.src = u;
      });
    prenderCard(card, m.id, null);
    box.appendChild(card);
  }
  if (!ms.length)
    box.innerHTML = `<p class="ed-vazio">${UI.cat === "importados" ? "Nenhum modelo seu ainda." : "Nada encontrado."}</p>`;
}
function prenderCard(card: HTMLElement, id: string, conjunto: string | null) {
  card.onpointerdown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    UI.arrasto = { tipo: "card", id, conjunto, cx0: e.clientX, cy0: e.clientY, mexeu: false };
  };
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/* inspetor (direita) */
function atualizarInspetor(soValores = false) {
  if (!UI.raiz || !ED.on) return;
  const sel = selecionadas(),
    box = $("#ed-insp"),
    chave = sel.map((p) => p.id).join(",");
  atualizarCamadas();
  atualizarRecados();
  if (soValores && chave === UI.inspetorDe) {
    preencherInspetor(sel);
    return;
  }
  UI.inspetorDe = chave;
  if (!sel.length && ORIG.sel.size) {
    const n = ORIG.sel.size,
      tipos = [...ORIG.sel.values()].map((o) =>
        o.tipo === "arvore" ? "árvore" : o.tipo === "pedra" ? "pedra" : "mato",
      );
    box.innerHTML = `<h4>${n === 1 ? "1 peça do mapa" : n + " peças do mapa"}</h4><p class="ed-leve">${[...new Set(tipos)].join(", ")} que o próprio mapa pôs aqui. Essas não mudam de lugar nem de tamanho; dá para <b>apagar</b> e pôr outras no lugar.</p><div class="ed-botoes"><button data-a="apagar-orig">🗑 Apagar do mapa</button></div><p class="ed-leve">Ctrl+Z traz de volta. O pincel com Shift também apaga as do mapa.</p>`;
    box.querySelector<HTMLButtonElement>("[data-a=apagar-orig]")!.onclick = () => apagarSelecionados();
    return;
  }
  if (!sel.length) {
    const n = pecasLer().length;
    box.innerHTML = `<h4>Nada selecionado</h4><p class="ed-leve">${n} peça(s) postas nesta cena.<br>Clique numa peça para mexer nela, ou escolha uma na biblioteca para colocar.</p>
      <p class="ed-leve">💡 Arraste no vazio para selecionar várias. Roda gira, Shift+roda muda o tamanho.</p>`;
    return;
  }
  const p = sel[0],
    info = infoModelo(p.m),
    tipo = info?.tipo,
    muitos = sel.length > 1;
  box.innerHTML = `<h4>${muitos ? sel.length + " peças" : esc(info?.nome || p.m)}</h4>
    ${tipo ? "" : `<label>Tamanho <input data-k="e" type="range" min="0.1" max="4" step="0.01"><output data-o="e"></output></label>`}
    ${tipo ? "" : `<label>Giro <input data-k="g" type="range" min="0" max="360" step="1"><output data-o="g"></output></label>`}
    <label>Altura <input data-k="y" type="range" min="-30" max="200" step="0.5"><output data-o="y"></output></label>
    ${tipo ? `<label>Alcance <input data-k="raio" type="range" min="4" max="600" step="1"><output data-o="raio"></output></label>` : ""}
    ${tipo ? `<label>Força <input data-k="forca" type="range" min="0" max="1.5" step="0.05"><output data-o="forca"></output></label>` : ""}
    ${
      tipo
        ? ""
        : `<label class="ed-linha">Cor <input data-k="tom" type="color"><input data-k="tomK" type="range" min="0" max="1" step="0.05" title="Quanto da cor"><button data-a="semcor" title="Tirar a cor">⦸</button></label>
           <label class="ed-linha"><input data-k="ilumina" type="checkbox"> Ilumina à noite <input data-k="luz" type="range" min="30" max="300" step="5"></label>`
    }
    <label>Camada <select data-k="cam">${Object.entries(CAMADAS)
      .filter(([k]) => k !== "recados")
      .map(([k, v]) => `<option value="${k}">${v.ico} ${v.nome}</option>`)
      .join("")}</select></label>
    <div class="ed-botoes">
      <button data-a="dup" title="Ctrl+D">⧉ Duplicar</button>
      <button data-a="del" title="Del">🗑 Apagar</button>
      ${UI.modelo && !tipo && !muitos ? `<button data-a="trocar" title="Troca pelo modelo escolhido na biblioteca">⇄ Trocar modelo</button>` : ""}
      <button data-a="conj">🧩 Salvar conjunto</button>
    </div>
    <div id="ed-conj-nome" hidden><input placeholder="Nome do conjunto (ex.: Acampamento)"><button>OK</button></div>`;
  preencherInspetor(sel);
  for (const inp of box.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-k]")) {
    const k = inp.dataset.k!;
    inp.addEventListener("input", () => {
      if (bloqueado()) return;
      abrirMudanca();
      for (const q of selecionadas()) aplicar(q, k, inp);
      mexeu();
      preencherInspetor(selecionadas(), inp);
    });
    inp.addEventListener("change", () => {
      fecharMudanca();
      if (k === "cam") atualizarCamadas();
    });
  }
  for (const b of box.querySelectorAll<HTMLButtonElement>("[data-a]"))
    b.onclick = () => {
      const a = b.dataset.a;
      if (a === "dup") duplicar();
      else if (a === "del") apagarSelecionados();
      else if (a === "semcor")
        mudar(() => {
          for (const q of selecionadas()) {
            delete q.tom;
            delete q.tomK;
          }
        });
      else if (a === "trocar" && UI.modelo) mudar(() => selecionadas().forEach((q) => (q.m = UI.modelo!)));
      else if (a === "conj") {
        const c = $("#ed-conj-nome");
        c.hidden = false;
        const inp = c.querySelector("input")!;
        inp.focus();
        const ok = () => {
          salvarConjunto(inp.value);
          c.hidden = true;
        };
        c.querySelector("button")!.onclick = ok;
        inp.onkeydown = (ev) => ev.key === "Enter" && ok();
      }
      if (a !== "conj") atualizarInspetor();
    };
}
function aplicar(q: Deco, k: string, inp: HTMLInputElement | HTMLSelectElement) {
  const v = inp.value,
    n = +v;
  if (k === "e") q.e = r3(n);
  else if (k === "g") q.g = r3((n * Math.PI) / 180);
  else if (k === "y") q.y = n ? r1(n) : undefined;
  else if (k === "raio") q.raio = Math.round(n);
  else if (k === "forca") q.forca = r3(n);
  else if (k === "tom") {
    q.tom = v;
    if (q.tomK == null) q.tomK = 0.5;
  } else if (k === "tomK") {
    q.tomK = r3(n);
    if (!q.tom) q.tom = "#ffd27a";
  } else if (k === "ilumina") q.luz = (inp as HTMLInputElement).checked ? q.luz || 120 : undefined;
  else if (k === "luz") q.luz = Math.round(n);
  else if (k === "cam") q.cam = v === infoModelo(q.m)?.cam ? undefined : v;
  for (const c of ["y", "luz"] as const) if (q[c] === undefined) delete q[c];
}
function preencherInspetor(sel: Deco[], menos?: Element) {
  const p = sel[0];
  if (!p) return;
  const box = $("#ed-insp"),
    val: Record<string, string> = {
      e: String(p.e ?? 1),
      g: String(Math.round(((p.g || 0) * 180) / Math.PI)),
      y: String(p.y || 0),
      raio: String(p.raio ?? 0),
      forca: String(p.forca ?? 1),
      tom: p.tom || "#ffd27a",
      tomK: String(p.tom ? (p.tomK ?? 0.5) : 0),
      luz: String(p.luz || 120),
      cam: camadaDe(p),
    };
  for (const inp of box.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-k]")) {
    if (inp === menos) continue;
    const k = inp.dataset.k!;
    if (k === "ilumina") (inp as HTMLInputElement).checked = !!p.luz;
    else if (k in val) inp.value = val[k];
  }
  const txt: Record<string, string> = {
    e: "×" + (+(p.e ?? 1)).toFixed(2),
    g: val.g + "°",
    y: val.y,
    raio: val.raio,
    forca: (+(p.forca ?? 1)).toFixed(2),
  };
  for (const o of box.querySelectorAll<HTMLOutputElement>("[data-o]")) o.textContent = txt[o.dataset.o!] || "";
}

/* camadas */
function atualizarCamadas() {
  const box = $("#ed-camadas"),
    conta: Record<string, number> = {};
  for (const p of pecasLer()) conta[camadaDe(p)] = (conta[camadaDe(p)] || 0) + 1;
  conta.recados = recadosLer().length;
  box.innerHTML = Object.entries(CAMADAS)
    .map(
      ([k, v]) =>
        `<div class="ed-camada${ED.camadasOcultas.has(k) ? " oculta" : ""}"><button data-olho="${k}" title="Mostrar/esconder">${ED.camadasOcultas.has(k) ? "◌" : "👁"}</button><button data-trava="${k}" title="Travar (não dá para clicar nela)">${UI.travadas.has(k) ? "🔒" : "🔓"}</button><span>${v.ico} ${v.nome}</span><small>${conta[k] || 0}</small></div>`,
    )
    .join("");
  for (const b of box.querySelectorAll<HTMLButtonElement>("[data-olho]"))
    b.onclick = () => {
      const k = b.dataset.olho!;
      if (ED.camadasOcultas.has(k)) ED.camadasOcultas.delete(k);
      else ED.camadasOcultas.add(k);
      ED.versao++;
      guardarPrefs();
      atualizarCamadas();
    };
  for (const b of box.querySelectorAll<HTMLButtonElement>("[data-trava]"))
    b.onclick = () => {
      const k = b.dataset.trava!;
      if (UI.travadas.has(k)) UI.travadas.delete(k);
      else UI.travadas.add(k);
      guardarPrefs();
      atualizarCamadas();
    };
}

/* recados */
function atualizarRecados() {
  const box = $("#ed-recados"),
    L = recadosLer(),
    todos = Object.values(ED.dados.recados).reduce((a, l) => a + l.filter((r) => !r.feito).length, 0);
  $("#ed-nrec").textContent = todos ? "(" + todos + " aberto" + (todos > 1 ? "s" : "") + ")" : "";
  if (!L.length) {
    box.innerHTML = `<p class="ed-leve">Use 📌 Recado (N) e clique no chão para pedir algo exatamente ali.</p>`;
    return;
  }
  box.innerHTML = L.map(
    (r) =>
      `<div class="ed-rec${r.feito ? " feito" : ""}" data-id="${r.id}"><span>${r.feito ? "✅" : "📌"} ${esc(r.texto || "(sem texto)")}</span><button data-ir title="Ir até lá">➜</button></div>`,
  ).join("");
  for (const el of box.querySelectorAll<HTMLElement>(".ed-rec")) {
    const r = L.find((q) => q.id === +el.dataset.id!)!;
    el.querySelector<HTMLElement>("[data-ir]")!.onclick = () => {
      const c = cantoCena();
      D3.cx = r.x - c.x;
      D3.cz = r.z - c.y;
      abrirRecado(r);
    };
    el.querySelector("span")!.addEventListener("click", () => abrirRecado(r));
  }
}
function abrirRecado(r: Recado, novo = false) {
  fecharRecado();
  const el = document.createElement("div");
  el.className = "ed-balao ed-painel";
  el.innerHTML = `<textarea placeholder="O que você quer aqui? (ex.: uma ponte de madeira ligando as duas margens)"></textarea>
    <div class="ed-botoes"><button data-a="ok">✔ Guardar</button><button data-a="feito">${r.feito ? "↺ Reabrir" : "✅ Feito"}</button><button data-a="del">🗑</button></div>`;
  UI.raiz!.appendChild(el);
  const ta = el.querySelector("textarea")!;
  ta.value = r.texto;
  UI.recado = { r, el };
  posicionarRecado();
  ta.focus();
  setTimeout(() => ta.focus(), 30);
  const guardar = () => {
    if (ta.value !== r.texto) mudar(() => (r.texto = ta.value.trim()));
  };
  for (const b of el.querySelectorAll<HTMLButtonElement>("[data-a]"))
    b.onclick = () => {
      const a = b.dataset.a;
      if (a === "ok") guardar();
      else if (a === "feito") {
        guardar();
        mudar(() => {
          if (r.feito) delete r.feito;
          else r.feito = true;
        });
      } else if (a === "del")
        mudar(() => {
          const c = cenaAtual()!;
          ED.dados.recados[c] = recadosLer().filter((q) => q !== r);
        });
      fecharRecado();
      atualizarRecados();
    };
  ta.onkeydown = (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      guardar();
      fecharRecado();
      atualizarRecados();
    }
  };
  if (novo) aviso("Escreva o pedido e aperte Enter. O Claude lê os recados quando você pedir.", 4000);
}
function posicionarRecado() {
  const R = UI.recado;
  if (!R) return;
  const t = telaDe(R.r.x, R.r.z, 0);
  R.el.style.left = Math.max(8, Math.min(innerWidth - 300, t.x - 140)) + "px";
  R.el.style.top = Math.max(60, t.y - 170) + "px";
}
function fecharRecado() {
  const R = UI.recado;
  if (!R) return;
  UI.recado = null;
  // recado novo deixado vazio some
  const c = cenaAtual();
  if (!R.r.texto && !R.r.feito && c && ED.dados.recados[c]?.includes(R.r))
    mudar(() => (ED.dados.recados[c] = ED.dados.recados[c].filter((q) => q !== R.r)));
  R.el.remove();
  atualizarRecados();
}
function fecharRecadoSeFora(e: Event) {
  if (UI.recado && !(e.target instanceof Node && UI.recado.el.contains(e.target))) {
    const ta = UI.recado.el.querySelector("textarea")!,
      r = UI.recado.r;
    if (ta.value.trim() !== r.texto) mudar(() => (r.texto = ta.value.trim()));
    fecharRecado();
  }
}

/* barra de baixo */
const DICAS: Record<Ferramenta, string> = {
  mover:
    "Clique: selecionar · arrastar: mover (Alt copia) · roda: girar (Shift: tamanho, Ctrl: zoom) · botão direito/meio ou WASD: câmera · Del apaga · T testa aqui · F2 sai",
  colocar: "Clique no chão para colocar · arraste da biblioteca para o chão · Esc ou botão direito volta para Mover",
  terreno:
    "Segure e arraste: 🟫 terra faz ilhas, 🌊 água faz lagos e rios · Shift troca · [ ] tamanho · o mapa muda junto",
  pincel: "Segure e arraste para pintar · Shift apaga · [ ] ou Ctrl+roda: tamanho do pincel · Esc volta para Mover",
  recado: "Clique no chão onde você quer algo · escreva o pedido · Enter guarda",
};
function atualizarStatus() {
  if (!UI.raiz || !ED.on) return;
  const agora = performance.now();
  $("#ed-dica").textContent = UI.aviso.ate > agora ? UI.aviso.texto : DICAS[UI.ferramenta];
  $("#ed-dica").classList.toggle("aviso", UI.aviso.ate > agora);
  const s = $("#ed-salvo");
  s.textContent = SALVO.gravando ? "salvando…" : SALVO.msg || (SALVO.servidor ? "tudo salvo" : "");
  s.className = SALVO.sujo ? "sujo" : SALVO.msg.startsWith("erro") ? "erro" : "";
  $<HTMLButtonElement>("#ed-desfazer").disabled = !podeDesfazer();
  $<HTMLButtonElement>("#ed-refazer").disabled = !podeRefazer();
}

/* janelas: histórico e rascunho */
function modal(html: string) {
  const m = $("#ed-modal");
  m.innerHTML = `<div class="ed-painel ed-janela">${html}</div>`;
  m.hidden = false;
  m.onpointerdown = (e) => {
    if (e.target === m) m.hidden = true;
  };
  return m;
}
async function abrirHistorico() {
  const m = modal(`<h4>🕘 Histórico</h4><p class="ed-leve">Carregando…</p>`);
  const lista = await listarHistorico();
  if (!(await temServidor())) {
    m.querySelector(".ed-janela")!.innerHTML =
      `<h4>🕘 Histórico</h4><p class="ed-leve">O histórico fica no modo ao vivo (abra o jogo pelo “Abrir jogo ao vivo.bat”).</p><div class="ed-botoes"><button data-f>Fechar</button></div>`;
    m.querySelector<HTMLButtonElement>("[data-f]")!.onclick = () => (m.hidden = true);
    return;
  }
  m.querySelector(".ed-janela")!.innerHTML =
    `<h4>🕘 Histórico <small>(cópias salvas sozinhas a cada ${EDITOR.historico} min e a cada 💾)</small></h4>
    <div class="ed-hist">${
      lista.length
        ? lista
            .map(
              (h) =>
                `<div class="ed-hrow" data-arq="${h.arq}"><b>${h.quando}</b><span>${h.pecas} peças · ${h.recados} recados</span><button data-a="ver" title="Segure para comparar com o agora">👁 Comparar</button><button data-a="voltar">↺ Voltar para esta</button></div>`,
            )
            .join("")
        : `<p class="ed-leve">Nenhuma cópia ainda (salve com 💾).</p>`
    }</div><div class="ed-botoes"><button data-f>Fechar</button></div>`;
  m.querySelector<HTMLButtonElement>("[data-f]")!.onclick = () => (m.hidden = true);
  for (const row of m.querySelectorAll<HTMLElement>(".ed-hrow")) {
    const arq = row.dataset.arq!;
    row.querySelector<HTMLButtonElement>("[data-a=ver]")!.onclick = async () => {
      const v = await lerVersao(arq);
      if (!v) return;
      ED.antes = v;
      m.hidden = true;
      aviso(
        "Comparando com " +
          row.querySelector("b")!.textContent +
          ": segure Espaço (ou ⇆ Antes/Depois) para ver essa versão.",
        6000,
      );
    };
    row.querySelector<HTMLButtonElement>("[data-a=voltar]")!.onclick = async () => {
      const v = await lerVersao(arq);
      if (!v) return;
      trocarDados(v);
      m.hidden = true;
      atualizarInspetor();
      aviso("Voltou para a versão de " + row.querySelector("b")!.textContent + " (Ctrl+Z desfaz).", 5000);
    };
  }
}
const AJUDA: [string, string][] = [
  ["Colocar", "Clique numa peça da biblioteca e depois no chão — ou arraste a peça direto para o chão"],
  ["Selecionar", "Clique na peça · Shift+clique soma · arraste no vazio para pegar várias · Ctrl+A pega tudo"],
  ["Mover", "Arraste a peça · Alt+arrastar faz uma cópia"],
  ["Girar", "Roda do mouse (ou Q / E) · R volta o giro"],
  ["Tamanho", "Shift + roda (ou + / −)"],
  ["Altura", "PgUp / PgDn"],
  ["Apagar", "Delete"],
  ["Copiar", "Ctrl+D duplica · Ctrl+C e Ctrl+V cola onde o mouse está"],
  ["Desfazer", "Ctrl+Z · refazer: Ctrl+Y"],
  [
    "Câmera",
    "Botão direito ou do meio arrastando · WASD ou setas (Shift: rápido) · Ctrl+roda aproxima · Home: volta na heroína",
  ],
  ["Pincel (P)", "Escolha uma planta, árvore ou pedra e pinte arrastando · Shift apaga · [ ] tamanho do pincel"],
  [
    "Terreno (I)",
    "Pinta 🟫 terra (ilhas, aterros) ou 🌊 água (lagos, rios, canais) no campo aberto; o mapa 2D muda junto · Shift troca",
  ],
  ["Mini mapa (M)", "Abre e fecha o mapa pequeno · clique nele para levar a câmera até lá"],
  ["Recado (N)", "Clique no chão e escreva o que quer ali — o Claude lê todos quando você pedir"],
  ["Grade (G)", "Ímã para alinhar casas, cercas e estradas"],
  ["Antes/Depois", "Segure Espaço para ver como estava na última vez que salvou"],
  ["Testar (T)", "Fecha o editor e põe a heroína onde o mouse está"],
  ["Painéis (H)", "Esconde/mostra os painéis para ver a cena limpa"],
  ["Salvar", "É sozinho, alguns segundos depois de mexer · Ctrl+S salva na hora e guarda uma cópia no Histórico"],
  ["Sair", "F2"],
];
function abrirAjuda() {
  const m =
    modal(`<h4>❓ Como usar o editor</h4><div class="ed-ajuda">${AJUDA.map(([a, b]) => `<b>${a}</b><span>${b}</span>`).join("")}</div>
    <p class="ed-leve">Modelos novos: jogue um .glb na pasta <code>modelos-novos</code> do projeto com o modo ao vivo aberto.</p>
    <div class="ed-botoes"><button data-f>Entendi</button></div>`);
  m.querySelector<HTMLButtonElement>("[data-f]")!.onclick = () => (m.hidden = true);
}
function perguntarRascunho(r: { quando: string; dados: DadosEditor }) {
  const m =
    modal(`<h4>Trabalho não salvo</h4><p>Achei uma decoração de ${new Date(r.quando).toLocaleString()} que não chegou a ser salva no arquivo. Quer recuperar?</p>
    <div class="ed-botoes"><button data-a="sim">↺ Recuperar</button><button data-a="nao">Descartar</button></div>`);
  m.querySelector<HTMLButtonElement>("[data-a=sim]")!.onclick = () => {
    trocarDados(r.dados);
    descartarRascunho();
    m.hidden = true;
    atualizarInspetor();
  };
  m.querySelector<HTMLButtonElement>("[data-a=nao]")!.onclick = () => {
    descartarRascunho();
    m.hidden = true;
  };
}

/* preferências (por navegador) */
function guardarPrefs() {
  try {
    localStorage.setItem(
      PREFS,
      JSON.stringify({
        ocultas: [...ED.camadasOcultas],
        mini: UI.mini,
        travadas: [...UI.travadas],
        grade: UI.grade,
        variar: UI.variar,
        cat: UI.cat,
      }),
    );
  } catch (_) {}
}
function lerPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) || "null");
    if (!p) return;
    ED.camadasOcultas = new Set(p.ocultas || []);
    UI.travadas = new Set(p.travadas || []);
    UI.grade = !!p.grade;
    UI.mini = p.mini !== false;
    UI.variar = p.variar !== false;
    if (p.cat) UI.cat = p.cat;
  } catch (_) {}
}

/* os modelos que o servidor ao vivo importou de modelos-novos/ */
async function sincronizarImportados(novos?: string[], erros?: string[]) {
  try {
    const r = await fetch("/__editor/modelos");
    if (!r.ok) return;
    const j = await r.json();
    trocarImportados(j.modelos || {});
    if (ED.on) {
      if (novos?.length) {
        UI.cat = "importados";
        montarBiblioteca();
        aviso("Modelo novo na biblioteca: " + novos.join(", "), 6000);
      } else montarCards();
      if (erros?.length) aviso("Não deu para importar: " + erros.join(" · "), 9000);
    }
  } catch (_) {}
}

/** Instala o editor (src/inicio/modulos/v8.1_editor.ts): lê a decoração, os atalhos e o botão de entrar. */
export function instalarEditor() {
  carregarDecoracao();
  window.addEventListener("keydown", aoTeclar, true);
  window.addEventListener("keyup", aoSoltarTecla, true);
  window.addEventListener("pointerdown", aoApertar, true);
  window.addEventListener("pointermove", aoMover, true);
  window.addEventListener("pointerup", aoSoltar, true);
  window.addEventListener("wheel", aoRolar, { capture: true, passive: false });
  window.addEventListener(
    "contextmenu",
    (e) => {
      if (ED.on && naCena(e)) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true,
  );
  // os cliques na cena não chegam no jogo (um clique dele tirava o foco da caixa do recado)
  for (const t of ["click", "dblclick", "mousedown", "mouseup", "touchstart"])
    window.addEventListener(
      t,
      (e) => {
        if (ED.on && naCena(e) && !noPainel(e)) e.stopPropagation();
      },
      true,
    );
  window.addEventListener("blur", () => UI.teclas.clear());
  window.addEventListener("resize", () => ED.on && medirTopo());
  // o botão de entrar, no canto do campo (só no modo ao vivo; F2 funciona sempre)
  if (/^https?:$/.test(location.protocol)) {
    const b = document.createElement("button");
    b.id = "ed-entrar";
    b.className = "btn";
    b.textContent = "🛠 Editor (F2)";
    b.title = "Modo Editor: decorar este lugar";
    b.onclick = (e) => {
      e.stopPropagation();
      pedirEditor();
    };
    // no mapa e no campo (do mapa, leva a personagem para o campo e abre)
    document.body.appendChild(b);
  }
  // sem campo desenhando, os sons de área param
  setInterval(() => {
    if (performance.now() - SOM.ultimo > 600) pararSomAmbiente();
  }, 500);
  import.meta.hot?.on(
    "editor:modelos",
    (msg: { ok?: string[]; erros?: string[] }) => void sincronizarImportados(msg.ok, msg.erros),
  );
}
