/* ==== v8.1 — Modo Editor: controle de qualidade das aparências sorteadas (mantenedor 2026-10-31: "às vezes saem
   personagens ótimos e às vezes muito ruins") ====
   Painel 👤 Aparências: escolhe corpo e cabeça (◀ ▶ ou na lista), marca a combinação como ✔ boa ou ✘ ruim (gravado em
   decoracao.json, `aparencias`; as notas servem à revisão visual), veste a heroína do campo com ela
   para ver andando (↺ volta a dela) e "Ver todas" põe todas as combinações paradas em fila no chão, com o número e a
   marca de cada uma em cima (editor/cena.ts desenha, editor/editor.ts põe os rótulos). */
import { dungeon } from "../core/state.ts";
import type { Hero } from "../core/tipos.ts";
import { GL3 } from "../core/state.ts";
import { D3 } from "../field/projecao.ts";
import { cabeNoCorpo, opcoesAparencia, type Aparencia } from "../render/gl/aparencias.ts";
import { VESTIDO, desenharAparencia } from "../render/gl/vestidos.ts";
import { RETRATO_PAINEL } from "../render/retrato.ts";
import { PALETA_CABELO, PALETA_PELE } from "../data/aparencias.ts";
import { ED } from "./estado.ts";
import { mudar } from "./dados.ts";

/** espaço entre as figuras da galeria (px do campo): entre colunas (cabeças) e entre linhas (corpos) */
const GAL = { dx: 36, dz: 70, ruim: [1, 0.25, 0.2, 0.45], sel: [1, 0.8, 0.25], selEsp: 2.4 };

const AP = {
  el: null as HTMLElement | null,
  corpo: 0,
  cabeca: 0,
  galeria: null as { x: number; z: number } | null,
  /** a aparência que a heroína do campo tinha antes de vestir uma daqui (null = a heroína de sempre) */
  originais: new WeakMap<Hero, Aparencia | null>(),
  /** as cores escolhidas ("" = a do modelo) */
  pele: "",
  cabelo: "",
  /** o canto da cena (cantoCena do editor/cena.ts, que importa este módulo) */
  canto: () => ({ x: 0, y: 0 }),
};

/** as combinações que existem (v8.1 — só cabeça do mesmo sexo do corpo, cabeNoCorpo) */
function combos() {
  const { corpos, cabecas } = opcoesAparencia();
  return corpos.flatMap((c, i) =>
    cabecas.flatMap((h, j) => (cabeNoCorpo(c, h) ? [{ corpo: c, cabeca: h, i, j }] : [])),
  );
}
const chave = (corpo: string, cabeca: string) => corpo + "|" + cabeca;
const nota = (k: string) => ED.dados.aparencias?.[k];

/** Abre (ou fecha) o painel dentro da raiz do editor. `centro`: onde a galeria fica (a câmera agora); `canto`: o
 *  canto da cena (cantoCena). */
export function alternarAparencias(
  raiz: HTMLElement,
  centro: { x: number; z: number },
  aviso: (t: string) => void,
  canto: () => { x: number; y: number },
) {
  AP.canto = canto;
  if (AP.el && !AP.el.hidden) {
    AP.el.hidden = true;
    AP.galeria = null;
    return;
  }
  const { corpos } = opcoesAparencia();
  if (!corpos.length) {
    aviso("Sem dados de aparência neste jogo.");
    return;
  }
  if (!AP.el) {
    const el = document.createElement("div");
    el.id = "ed-ap";
    el.className = "ed-painel";
    el.innerHTML = `<div class="ed-ap-topo"><b>👤 Aparências</b><button data-a="x" title="Fechar">✕</button></div>
  <canvas id="ed-ap-palco" width="400" height="520" title="Arraste para girar · dois cliques: de frente"></canvas>
  <div class="ed-ap-linha"><span>Corpo</span><button data-a="c-">◀</button><b id="ed-ap-corpo"></b><button data-a="c+">▶</button></div>
  <div class="ed-ap-linha"><span>Cabeça</span><button data-a="h-">◀</button><b id="ed-ap-cab"></b><button data-a="h+">▶</button></div>
  <div class="ed-ap-cores"><span>Pele</span>${amostras("pele", PALETA_PELE)}<input type="color" data-livre="pele" title="Outra cor de pele"></div>
  <div class="ed-ap-cores"><span>Cabelo</span>${amostras("cabelo", PALETA_CABELO)}<input type="color" data-livre="cabelo" title="Outra cor de cabelo"></div>
  <div class="ed-botoes"><button data-a="boa" title="Marcar aparência como boa">✔ Boa</button><button data-a="ruim" title="Marcar aparência para revisão">✘ Ruim</button><button data-a="limpa" title="Tirar a marca">⦸</button></div>
  <div class="ed-botoes"><button data-a="todas" title="Todas as combinações paradas em fila no chão">👥 Ver todas</button><button data-a="vestir" title="A heroína do campo veste esta (para ver andando: ▶ Testar aqui)">🧍 Vestir a heroína</button><button data-a="original" title="A heroína volta à aparência dela">↺ Original</button></div>
  <p class="ed-leve" id="ed-ap-conta"></p>
  <div id="ed-ap-lista"></div>`;
    raiz.appendChild(el);
    AP.el = el;
    prenderPalco(el.querySelector<HTMLCanvasElement>("#ed-ap-palco")!);
    for (const inp of el.querySelectorAll<HTMLInputElement>("[data-livre]"))
      inp.oninput = () => {
        AP[inp.dataset.livre as "pele" | "cabelo"] = inp.value;
        atualizar();
      };
    el.onclick = (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-a],[data-k],[data-cor]");
      if (!b) return;
      if (b.dataset.cor !== undefined) {
        AP[b.dataset.tipo as "pele" | "cabelo"] = b.dataset.cor;
        atualizar();
        return;
      }
      if (b.dataset.k) {
        const [i, j] = b.dataset.k.split(",").map(Number);
        escolher(i, j, true);
        return;
      }
      acao(b.dataset.a!, centro, aviso);
    };
  }
  AP.el.hidden = false;
  // O visor de modelos também usa o retrato: recuperar o canvas e a câmera ao reabrir.
  Object.assign(RETRATO_PAINEL, {
    cv: AP.el.querySelector<HTMLCanvasElement>("#ed-ap-palco"),
    modelo: "",
    clip: "parada",
    tempo: 0,
    t: 0,
    reproduzir: true,
    zoom: 1,
    yaw: -0.35,
    auto: true,
  });
  atualizar();
}

/** O palco: a personagem escolhida como na tela de criação (render/retrato.ts retratoPainelQuadro desenha). Arrastar
 *  gira; soltar volta a girar sozinho depois de um tempo; dois cliques põem de frente. */
function prenderPalco(cv: HTMLCanvasElement) {
  const P = RETRATO_PAINEL;
  P.cv = cv;
  let arrasto: { x: number; yaw: number } | null = null,
    solto: ReturnType<typeof setTimeout> | 0 = 0;
  cv.onpointerdown = (e) => {
    cv.setPointerCapture(e.pointerId);
    arrasto = { x: e.clientX, yaw: P.yaw };
    P.auto = false;
    if (solto) clearTimeout(solto);
  };
  cv.onpointermove = (e) => {
    if (arrasto) P.yaw = arrasto.yaw + (e.clientX - arrasto.x) * 0.012;
  };
  cv.onpointerup = cv.onpointercancel = () => {
    arrasto = null;
    solto = setTimeout(() => (P.auto = true), 2500);
  };
  cv.ondblclick = () => {
    P.yaw = -0.35;
    P.auto = false;
  };
}

/** `passo`: para que lado pular as cabeças que não servem no corpo (v8.1, as do outro sexo) */
function escolher(i: number, j: number, irAte = false, passo = 1) {
  const { corpos, cabecas } = opcoesAparencia(),
    n = cabecas.length;
  AP.corpo = (i + corpos.length) % corpos.length;
  let h = (j + n) % n;
  for (let k = 0; k < n && !cabeNoCorpo(corpos[AP.corpo], cabecas[h]); k++) h = (h + passo + n) % n;
  AP.cabeca = h;
  if (irAte && AP.galeria) {
    const p = posGaleria(AP.corpo, AP.cabeca),
      c = AP.canto();
    D3.cx = p.x - c.x;
    D3.cz = p.z - c.y;
  }
  atualizar();
}
function atual(): Aparencia {
  const { corpos, cabecas } = opcoesAparencia(),
    v: Aparencia = { corpo: corpos[AP.corpo].nome, cabeca: cabecas[AP.cabeca].nome };
  if (AP.pele) v.pele = AP.pele;
  if (AP.cabelo) v.cabelo = AP.cabelo;
  return v;
}
/** As amostras de cor de uma paleta ("" = a original do modelo). */
function amostras(tipo: "pele" | "cabelo", paleta: { cor: string; nome: string }[]) {
  return paleta
    .map(
      (p) =>
        `<button class="ed-ap-cor${p.cor ? "" : " orig"}" data-tipo="${tipo}" data-cor="${p.cor}" title="${p.nome}" style="${p.cor ? "background:" + p.cor : ""}">${p.cor ? "" : "↺"}</button>`,
    )
    .join("");
}

function acao(a: string, centro: { x: number; z: number }, aviso: (t: string) => void) {
  const v = atual(),
    k = chave(v.corpo, v.cabeca),
    h = dungeon.hero;
  if (a === "x") {
    AP.el!.hidden = true;
    AP.galeria = null;
  } else if (a === "c-" || a === "c+") escolher(AP.corpo + (a === "c+" ? 1 : -1), AP.cabeca, true);
  else if (a === "h-" || a === "h+") escolher(AP.corpo, AP.cabeca + (a === "h+" ? 1 : -1), true, a === "h+" ? 1 : -1);
  else if (a === "boa" || a === "ruim" || a === "limpa")
    mudar(() => {
      const n = (ED.dados.aparencias ||= {});
      if (a === "limpa" || n[k] === a) delete n[k];
      else n[k] = a;
    });
  else if (a === "todas") {
    AP.galeria = AP.galeria ? null : { ...centro };
    if (AP.galeria) aviso("Todas as aparências em fila: uma linha por corpo, uma coluna por cabeça");
  } else if (a === "vestir" && h) {
    if (!AP.originais.has(h)) AP.originais.set(h, h.visual ? { ...h.visual } : null);
    VESTIDO.atual = null;
    VESTIDO.heroi = null;
    h.visual = { ...v };
    aviso("A heroína vestiu esta aparência (▶ Testar aqui para ver andando; ↺ Original volta)");
  } else if (a === "original" && h && AP.originais.has(h)) {
    const original = AP.originais.get(h);
    VESTIDO.atual = null;
    VESTIDO.heroi = null;
    if (original) h.visual = { ...original };
    else delete h.visual;
    AP.originais.delete(h);
    aviso("A heroína voltou à aparência dela");
  }
  atualizar();
}

function atualizar() {
  const el = AP.el;
  if (!el) return;
  const { corpos, cabecas } = opcoesAparencia(),
    v = atual(),
    n = nota(chave(v.corpo, v.cabeca));
  RETRATO_PAINEL.cv = el.querySelector<HTMLCanvasElement>("#ed-ap-palco");
  RETRATO_PAINEL.modelo = "";
  // "heroina" + "propria" sem cores = a heroína de sempre (sem visual), como no jogo
  RETRATO_PAINEL.visual = v.corpo === "heroina" && v.cabeca === "propria" && !v.pele && !v.cabelo ? undefined : v;
  for (const b of el.querySelectorAll<HTMLElement>(".ed-ap-cor"))
    b.classList.toggle("on", AP[b.dataset.tipo as "pele" | "cabelo"] === b.dataset.cor);
  el.querySelector("#ed-ap-corpo")!.textContent = corpos[AP.corpo].rotulo;
  el.querySelector("#ed-ap-cab")!.textContent = cabecas[AP.cabeca].rotulo;
  el.querySelector('[data-a="boa"]')!.classList.toggle("on", n === "boa");
  el.querySelector('[data-a="ruim"]')!.classList.toggle("on", n === "ruim");
  el.querySelector('[data-a="todas"]')!.classList.toggle("on", !!AP.galeria);
  const L = combos(),
    boas = L.filter((c) => nota(chave(c.corpo.nome, c.cabeca.nome)) === "boa").length,
    ruins = L.filter((c) => nota(chave(c.corpo.nome, c.cabeca.nome)) === "ruim").length;
  el.querySelector("#ed-ap-conta")!.textContent =
    `${L.length} combinações · ✔ ${boas} boas · ✘ ${ruins} ruins · ${L.length - boas - ruins} sem marca`;
  el.querySelector("#ed-ap-lista")!.innerHTML = L.map((c, k) => {
    const m = nota(chave(c.corpo.nome, c.cabeca.nome)),
      on = c.i === AP.corpo && c.j === AP.cabeca;
    return `<button data-k="${c.i},${c.j}" class="${on ? "on" : ""} ${m || ""}" title="${c.corpo.rotulo} + ${c.cabeca.rotulo}">${k + 1}${m === "boa" ? " ✔" : m === "ruim" ? " ✘" : ""}</button>`;
  }).join("");
}

/* ---------- a galeria no chão ---------- */
function posGaleria(i: number, j: number) {
  const { corpos, cabecas } = opcoesAparencia(),
    g = AP.galeria!;
  return { x: g.x + (j - (cabecas.length - 1) / 2) * GAL.dx, z: g.z + (i - (corpos.length - 1) / 2) * GAL.dz };
}

/** Põe as figuras da galeria na lista de desenho (editor/cena.ts decoGLPush, só com o editor aberto); `c` = o canto
 *  da cena (cantoCena). */
export function galeriaGLPush(c: { x: number; y: number }) {
  if (!ED.on || !AP.galeria || !AP.el || AP.el.hidden) return;
  for (const k of combos()) {
    const p = posGaleria(k.i, k.j),
      ruim = nota(chave(k.corpo.nome, k.cabeca.nome)) === "ruim";
    desenharAparencia(
      { corpo: k.corpo.nome, cabeca: k.cabeca.nome },
      p.x - c.x,
      p.z - c.y,
      -Math.PI / 2, // de frente para a câmera (que olha do sul)
      ruim ? GAL.ruim : null,
    );
    const it = GL3.list[GL3.list.length - 1];
    if (!it) continue;
    if (k.i === AP.corpo && k.j === AP.cabeca) {
      it.olCor = GAL.sel;
      it.olEsp = GAL.selEsp;
    }
  }
}

/** Os números e as marcas em cima das figuras (editor.ts desenharTela). `tela(ax, az, h)` = ponto na tela. */
export function galeriaRotulos(
  c: CanvasRenderingContext2D,
  tela: (ax: number, az: number, h?: number) => { x: number; y: number; k: number },
) {
  if (!AP.galeria || !AP.el || AP.el.hidden) return;
  c.textAlign = "center";
  c.textBaseline = "middle";
  combos().forEach((k, n) => {
    const p = posGaleria(k.i, k.j),
      t = tela(p.x, p.z, 64),
      m = nota(chave(k.corpo.nome, k.cabeca.nome)),
      sel = k.i === AP.corpo && k.j === AP.cabeca;
    c.font = `bold ${sel ? 15 : 12}px Georgia, serif`;
    c.fillStyle = "rgba(20,14,8,.75)";
    c.beginPath();
    c.arc(t.x, t.y, sel ? 14 : 11, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = m === "ruim" ? "#ff7a6a" : m === "boa" ? "#9be08a" : sel ? "#ffd27a" : "#f3e6c4";
    c.fillText(String(n + 1), t.x, t.y + 1);
    if (m) c.fillText(m === "boa" ? "✔" : "✘", t.x, t.y - 20);
  });
}
