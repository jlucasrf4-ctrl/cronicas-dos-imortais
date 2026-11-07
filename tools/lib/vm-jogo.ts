/* Roda o JS do jogo dentro do Node (node:vm), sem navegador, para testes de lógica (Fase 3+ do ROADMAP).

   Não é um navegador: o DOM é um "coringa" (todo acesso devolve outro coringa, toda chamada também; o valor gravado
   numa propriedade é lido de volta, sem nenhum efeito), canvas/WebGL viram chamadas vazias. Cada gravação
   (el.innerHTML = …, el.style.display = …) e cada chamada (classList.add, …) fica registrada com o caminho do elemento
   (#id, $seletor, <tag>), para o teste comparar o que foi escrito (ver escritas()). O que é real e determinístico:
     - Math.random com semente (mulberry32), performance.now/Date.now num relógio virtual
     - setTimeout/setInterval/requestAnimationFrame numa fila virtual: só rodam quando o teste chama avancar(ms)
     - localStorage em memória
   Serve para comparar duas versões do jogo rodando o mesmo roteiro (teste diferencial): se o estado final bate,
   a mudança não alterou a lógica naquele caminho. Rodar `init()` (montar a tela) não é suportado. */
import vm from "node:vm";
import { createHash, type Hash } from "node:crypto";

/** O DOM falso: cada caminho (ex.: "#inv-modal.style") é um coringa — qualquer propriedade, chamada ou `new`
    devolve outro coringa. Gravações e chamadas vão para `registrar` como texto ("#hud.innerHTML=…"). */
const RE_IMG = /data:[^"')\s]+|\/src\/assets\/[\w\-./]+/g;
function criarDom(registrar: (linha: string) => void) {
  const cache = new Map<string, unknown>();
  const nossos = new WeakSet<object>();
  const caminhoDe = new WeakMap<object, string>();
  // classes de cada elemento (classList.add/remove/toggle, className = …), para contains() e querySelector("#id.classe")
  const classes = new Map<string, Set<string>>();
  const classesDe = (el: string) => {
    let c = classes.get(el);
    if (!c) classes.set(el, (c = new Set()));
    return c;
  };
  // ouvintes de cada elemento ("caminho|tipo" -> funções), para removeEventListener
  const ouvintesEl = new Map<string, Set<unknown>>();
  const RE_SIMPLES = /^#([\w-]+)((?:\.[\w-]+)*)$/;
  /** Seletor só com "#id" ou "#id.classe…" (vários separados por vírgula): os elementos que casam; null se for outro tipo. */
  const casar = (sel: string): unknown[] | null => {
    const achados: unknown[] = [];
    for (const parte of sel.split(",")) {
      const m = parte.trim().match(RE_SIMPLES);
      if (!m) return null;
      const cls = m[2].split(".").filter(Boolean);
      if (cls.every((c) => classesDe("#" + m[1]).has(c))) achados.push(dom("#" + m[1]));
    }
    return achados;
  };
  const fmt = (v: unknown): string => {
    if (typeof v === "function") return nossos.has(v) ? "@" + caminhoDe.get(v) : "ƒ";
    if (v && typeof v === "object") return Array.isArray(v) ? "[" + v.map(fmt).join(",") + "]" : "{}";
    const t = String(v);
    // imagens: a referência tem data URIs, o build de teste tem "/src/assets/…" (e os ícones mudaram de bytes)
    return t.length > 20 && (t.includes("data:") || t.includes("/src/assets/")) ? t.replace(RE_IMG, "‹img›") : t;
  };
  // contextos de canvas (2D/WebGL): um coringa só, mudo — volume enorme, e o WebGL já é comparado pelo GL3.list
  const mudo: unknown = new Proxy(function () {}, {
    get(_, k) {
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === Symbol.iterator) return function* () {};
      if (typeof k === "symbol" || k === "then") return undefined;
      if (k === "length") return 0;
      return mudo;
    },
    apply: () => mudo,
    construct: () => mudo as object,
    set: () => true,
    has: () => true,
    deleteProperty: () => true,
  });
  const dom = (caminho: string): unknown => {
    if (caminho.length > 80) caminho = caminho.slice(0, 80);
    const ja = cache.get(caminho);
    if (ja) return ja;
    const filhos = new Map<string, unknown>();
    const gravados = new Map<string, unknown>(); // o que o jogo gravou aqui (el._h = …, style.display = …) é lido de volta
    const alvo = function () {};
    const p: unknown = new Proxy(alvo, {
      get(_, k) {
        if (k === Symbol.toPrimitive) return () => 0;
        if (k === Symbol.iterator) return function* () {};
        if (typeof k === "symbol" || k === "then") return undefined;
        if (k === "length") return 0;
        if (gravados.has(k)) return gravados.get(k);
        let f = filhos.get(k);
        if (!f) filhos.set(k, (f = dom(caminho + "." + k)));
        return f;
      },
      apply(_, __, args: unknown[]) {
        const metodo = caminho.slice(caminho.lastIndexOf(".") + 1),
          a0 = args.length ? fmt(args[0]) : "";
        if (metodo === "getContext") return mudo;
        if (metodo === "getElementById") return dom("#" + a0);
        if (metodo === "querySelector" || metodo === "querySelectorAll") {
          const achados = casar(a0);
          if (achados) return metodo === "querySelector" ? (achados[0] ?? null) : achados;
          return dom("$" + a0);
        }
        if (metodo === "closest") return dom("$" + a0);
        if (caminho.endsWith(".classList." + metodo)) {
          const c = classesDe(caminho.slice(0, -(".classList." + metodo).length)),
            nome = String(args[0]);
          if (metodo === "contains") return c.has(nome);
          if (metodo === "add") for (const a of args) c.add(String(a));
          else if (metodo === "remove") for (const a of args) c.delete(String(a));
          else if (metodo === "toggle") {
            const liga = args.length > 1 ? !!args[1] : !c.has(nome);
            if (liga) c.add(nome);
            else c.delete(nome);
            registrar(caminho + "(" + args.map(fmt).join(",") + ")");
            return liga;
          }
        }
        if (metodo === "createElement") return dom("<" + a0 + ">");
        // ouvintes de elemento: guardados por elemento (para clicar(id)), não entram no registro de escritas;
        // o que eles fazem aparece quando o roteiro clica
        if (metodo === "addEventListener" || metodo === "removeEventListener") {
          const chave = caminho.slice(0, -(metodo.length + 1)) + "|" + a0;
          const s = ouvintesEl.get(chave) ?? ouvintesEl.set(chave, new Set()).get(chave)!;
          if (metodo === "addEventListener") s.add(args[1]);
          else s.delete(args[1]);
          return undefined;
        }
        registrar(caminho + "(" + args.map(fmt).join(",") + ")");
        return dom(caminho + "()");
      },
      construct: () => dom("new " + caminho) as object,
      set(_, k, v) {
        registrar(caminho + "." + String(k) + "=" + fmt(v));
        gravados.set(String(k), v);
        if (k === "className") classes.set(caminho, new Set(String(v).split(/\s+/).filter(Boolean)));
        return true;
      },
      has: () => true,
      deleteProperty: () => true,
    });
    nossos.add(p as object);
    caminhoDe.set(p as object, caminho);
    cache.set(caminho, p);
    return p;
  };
  /** Chama os ouvintes de um elemento (ex.: "#dungeon-weapon", "click"), como um clique de verdade. */
  const disparar = (el: string, tipo: string) => {
    const e = {
      type: tipo,
      target: dom(el),
      currentTarget: dom(el),
      button: 0,
      preventDefault() {},
      stopPropagation() {},
    };
    for (const f of [...(ouvintesEl.get(el + "|" + tipo) ?? [])]) if (typeof f === "function") f.call(dom(el), e);
  };
  return Object.assign(dom, { disparar });
}

function mulberry32(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface JogoVm {
  /** `window.__t` do build de teste (as funções e o estado expostos por src/dev/gancho.ts). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
  /** Avança o relógio virtual rodando os timers e quadros que vencerem (em ordem de vencimento). */
  avancar(ms: number): void;
  /** Ouvintes registrados em window/document (ex.: "keydown"). */
  ouvintes: Map<string, ((e: unknown) => void)[]>;
  /** Erros lançados por timers/quadros (o jogo seguiria rodando no navegador; aqui ficam guardados). */
  erros: unknown[];
  /** Clique num elemento pelo id: chama os ouvintes "click" que o jogo ligou nele. */
  clicar(id: string): void;
  /** O que foi escrito no DOM/canvas desde a última chamada: quantidade, hash e as últimas linhas (para diagnóstico). */
  escritas(): { n: number; hash: string; ultimas: string[] };
  /** Quantas escritas foram descartadas por `ignorar` (ver carregarJogo). */
  ignoradas: number;
}

interface Timer {
  id: number;
  quando: number;
  fn: (...a: unknown[]) => void;
  repete: number;
}

/** Carrega o script principal do jogo (com o gancho de teste) num contexto novo. `ignorar`: linhas exatas do registro
    de escritas que não contam (chamadas que uma correção tirou de propósito, para comparar o resto com a v7.6). */
export function carregarJogo(js: string, semente = 1, ignorar: ReadonlySet<string> = new Set()): JogoVm {
  let agora = 1000;
  const fila: Timer[] = [];
  // id do timer: depende só do código da função e de quantos timers ela já criou, para que acrescentar ou tirar um
  // setTimeout em outro lugar não mude os ids dos outros (o jogo às vezes grava o id; o navegador não promete valores)
  const porFonte = new Map<string, number>(),
    usados = new Set<number>();
  const novoId = (fn: unknown) => {
    const src = String(fn);
    let h = 2166136261;
    for (let i = 0; i < src.length; i++) h = Math.imul(h ^ src.charCodeAt(i), 16777619) >>> 0;
    const n = (porFonte.get(src) ?? 0) + 1;
    porFonte.set(src, n);
    let id = (h % 100000) * 10000 + n;
    while (usados.has(id)) id++;
    usados.add(id);
    return id;
  };
  const erros: unknown[] = [];
  const agendar = (fn: unknown, ms: unknown, repete: boolean) => {
    if (typeof fn !== "function") return 0;
    const d = Math.max(0, Number(ms) || 0);
    const t: Timer = { id: novoId(fn), quando: agora + d, fn: fn as Timer["fn"], repete: repete ? Math.max(1, d) : 0 };
    fila.push(t);
    return t.id;
  };
  const cancelar = (id: unknown) => {
    const i = fila.findIndex((t) => t.id === id);
    if (i >= 0) fila.splice(i, 1);
  };
  const ouvintes = new Map<string, ((e: unknown) => void)[]>();
  const ouvir = (tipo: unknown, fn: unknown) => {
    if (typeof fn !== "function") return;
    const l = ouvintes.get(String(tipo)) ?? [];
    l.push(fn as (e: unknown) => void);
    ouvintes.set(String(tipo), l);
  };
  const armazenamento = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => (armazenamento.has(k) ? armazenamento.get(k)! : null),
    setItem: (k: string, v: unknown): void => void armazenamento.set(k, String(v)),
    removeItem: (k: string): void => void armazenamento.delete(k),
    clear: () => armazenamento.clear(),
    key: (i: number) => [...armazenamento.keys()][i] ?? null,
    get length() {
      return armazenamento.size;
    },
  };
  const M = Object.create(Math) as Math;
  M.random = mulberry32(semente);
  class DataVirtual extends Date {
    constructor(...a: unknown[]) {
      if (a.length) super(...(a as [string]));
      else super(agora + 1.7e12);
    }
    static now() {
      return agora + 1.7e12;
    }
  }
  let hash: Hash = createHash("sha1"),
    nEscritas = 0,
    ignoradas = 0;
  const ultimas: string[] = [];
  const dom = criarDom((linha) => {
    if (ignorar.has(linha)) {
      ignoradas++;
      return;
    }
    hash.update(linha + "\n");
    nEscritas++;
    ultimas.push(linha);
    if (ultimas.length > 12) ultimas.shift();
  });
  const documento = new Proxy(dom("document") as object, {
    get(t, k) {
      if (k === "addEventListener") return ouvir;
      return Reflect.get(t, k);
    },
  });

  // Tudo que não estiver aqui vira coringa (o contexto responde "sim" a qualquer nome global).
  const proprios: Record<string, unknown> = {
    console,
    Math: M,
    Date: DataVirtual,
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Symbol,
    BigInt,
    Map,
    Set,
    WeakMap,
    WeakSet,
    WeakRef,
    Promise,
    Error,
    TypeError,
    RangeError,
    SyntaxError,
    ReferenceError,
    RegExp,
    Proxy,
    Reflect,
    Intl,
    Float32Array,
    Float64Array,
    Int8Array,
    Int16Array,
    Int32Array,
    Uint8Array,
    Uint8ClampedArray,
    Uint16Array,
    Uint32Array,
    ArrayBuffer,
    DataView,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    Infinity,
    NaN,
    undefined,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
    atob,
    btoa,
    structuredClone,
    setTimeout: (fn: unknown, ms: unknown) => agendar(fn, ms, false),
    setInterval: (fn: unknown, ms: unknown) => agendar(fn, ms, true),
    requestAnimationFrame: (fn: unknown) => agendar(fn, 16, false),
    clearTimeout: cancelar,
    clearInterval: cancelar,
    cancelAnimationFrame: cancelar,
    queueMicrotask: (fn: () => void) => agendar(fn, 0, false),
    performance: { now: () => agora },
    localStorage,
    document: documento,
    addEventListener: ouvir,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx: any = new Proxy(proprios, {
    has: () => true,
    get(t, k) {
      if (k in t) return t[k as string];
      if (k === "window" || k === "globalThis" || k === "self" || k === "top" || k === "parent") return ctx;
      return typeof k === "string" ? dom(k) : undefined;
    },
    set(t, k, v) {
      t[k as string] = v;
      return true;
    },
  });
  vm.createContext(ctx);
  vm.runInContext(js, ctx, { filename: "jogo.js" });

  return {
    t: proprios.__t,
    ouvintes,
    erros,
    clicar: (id: string) => dom.disparar("#" + id, "click"),
    get ignoradas() {
      return ignoradas;
    },
    escritas() {
      const r = { n: nEscritas, hash: hash.digest("hex"), ultimas: ultimas.splice(0) };
      hash = createHash("sha1");
      nEscritas = 0;
      return r;
    },
    avancar(ms: number) {
      const fim = agora + ms;
      for (;;) {
        let prox: Timer | undefined;
        for (const t of fila) if (t.quando <= fim && (!prox || t.quando < prox.quando)) prox = t;
        if (!prox) break;
        agora = prox.quando;
        if (prox.repete) prox.quando += prox.repete;
        else fila.splice(fila.indexOf(prox), 1);
        try {
          prox.fn(agora);
        } catch (e) {
          erros.push(e);
        }
      }
      agora = fim;
    },
  };
}

/** Estado serializável (sem funções/coringas, sem ciclos), para comparar duas execuções. */
export function retrato(v: unknown): string {
  const vistos = new WeakSet<object>();
  return JSON.stringify(v, (_, x) => {
    if (typeof x === "function") return undefined;
    if (typeof x === "number" && !Number.isFinite(x)) return String(x);
    if (x && typeof x === "object") {
      if (vistos.has(x)) return "[ciclo]";
      vistos.add(x);
      if (ArrayBuffer.isView(x)) return `[${x.constructor.name} ${(x as unknown as ArrayLike<number>).length}]`;
    }
    return x;
  });
}
