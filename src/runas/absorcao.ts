/* ==== Fase 4 — absorção de runas: o minigame de 8 passos e a umidade da agulha (v4.4, v5.8) ==== */
import { sfx, renderInv, addRing } from "../field/chao.ts";
import { dungeon, SEL } from "../core/state.ts";
import { RUNE_SUBS, RUNE_EL, RUNE_LIQ, RA_STEPS, RA_SLOTS, RA_WET } from "../data/runas.ts";
import {
  runeSubsOf,
  runeGive,
  runeList,
  openRuneInspector,
  runeCount,
  runeTake,
  runePattern,
  runeScore,
  runeDefKey,
  runeDef,
  runeRng,
  rgba,
  runeLeafPatch,
  runeStrokes,
  runeSamples,
} from "./runas.ts";
import { itemMsg, spawnDungeonToast } from "../field/masmorra.ts";
import { updateEcon } from "../econ/economia.ts";
import { cineSfx } from "../audio/som.ts";
import { profLv } from "../hero/proficiencias.ts";
import { gainSkill } from "../hero/nivel.ts";
import { ITEM_DEFS } from "../data/itens.ts";
import { glFree } from "../render/gl/malhas.ts";
import { pushEvent } from "../sim/eventos.ts";
import { updateHeroPanelUI } from "../ui/painel.ts";
import { mvToast } from "../ui/avisos.ts";
import { icoItem } from "../ui/icones.ts";
import type { Hero, Runa } from "../core/tipos.ts";

/* =====================================================================
   ABSORÇÃO — minigame em 8 passos (funciona com mouse e com o dedo)
===================================================================== */
interface EstadoRA {
  open: boolean;
  // runeAbsorbOpen põe estes antes de tudo que os lê (o resto só roda com a janela aberta)
  step: string;
  heat: number;
  sel: string[];
  used: string[]; // substratos gastos nesta tentativa (chaves de RUNE_SUBS)
  spent: number;
  fixT: number;
  cur: number[][] | null; // traço em curso: pontos [x, y, molhado]
  sketch: number[][][];
  trace: number[][][];
  h: Hero;
  r: Runa;
  where: string; // "mapa" | "dungeon"
  res: ResultadoAbsorcao | null;
  last: number;
  // acrescentados depois
  holding?: boolean;
  raf?: number;
  soak?: number;
  wet?: number;
  wetRes?: { dry: number; wet: number; ok: number };
  _dipS?: number;
  bg?: HTMLCanvasElement | null;
  sheet?: HTMLCanvasElement | null;
}
export const RA = { open: false } as EstadoRA;
/** A nota do traçado (raCompute): cobertura, precisão, esboço, o melhor substrato e a runa que sai (ou nenhuma). */
interface ResultadoAbsorcao {
  s: number;
  cov: number;
  prec: number;
  sk: number;
  best: string;
  tier: string | null;
  key: string | null;
}

export function raEnsureDom() {
  if (document.getElementById("ra-modal")) return;
  const m = document.createElement("div");
  m.id = "ra-modal";
  m.innerHTML =
    '<div id="ra-card"><div id="ra-head"><b id="ra-title"></b><button class="btn" id="ra-x" title="Fechar">✕</button></div>' +
    '<div id="ra-body"><div id="ra-cvwrap"><canvas id="ra-cv"></canvas><div id="ra-cvhint"></div></div><div id="ra-side"><ol id="ra-steps"></ol><div id="ra-panel"></div><div id="ra-btns"></div></div></div></div>';
  document.body.appendChild(m);
  const cv = m.querySelector("#ra-cv") as HTMLCanvasElement;
  cv.addEventListener("pointerdown", (e) => {
    if (!RA.open || (RA.step !== "sketch" && RA.step !== "trace")) return;
    e.preventDefault();
    try {
      cv.setPointerCapture(e.pointerId);
    } catch (_) {}
    RA.cur = [raWetPt(raPt(e), 0)];
    (RA.step === "sketch" ? RA.sketch : RA.trace).push(RA.cur);
    if (RA.step === "trace") sfx("twang");
  });
  cv.addEventListener("pointermove", (e) => {
    if (!RA.cur) return;
    e.preventDefault();
    const p = raPt(e),
      q = RA.cur[RA.cur.length - 1],
      dd = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (dd > 0.012) RA.cur.push(raWetPt(p, dd));
  });
  const up = () => {
    if (RA.cur && RA.cur.length < 2) {
      const arr = RA.step === "sketch" ? RA.sketch : RA.trace;
      arr.splice(arr.indexOf(RA.cur), 1);
    }
    RA.cur = null;
    raRender();
  };
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);
  m.querySelector("#ra-x")!.addEventListener("click", () => raClose(true));
  m.querySelector("#ra-btns")!.addEventListener("pointerdown", (e) => {
    const b = (e.target as HTMLElement).closest("[data-hold]");
    if (b) {
      e.preventDefault();
      RA.holding = true;
    }
  });
  window.addEventListener("pointerup", () => {
    RA.holding = false;
  });
  window.addEventListener("pointercancel", () => {
    RA.holding = false;
  });
  m.querySelector("#ra-btns")!.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button[data-a]") as HTMLButtonElement;
    if (!b || b.disabled) return;
    raAct(b.dataset.a!);
  });
  m.querySelector("#ra-panel")!.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button[data-sub]") as HTMLButtonElement;
    if (!b || b.disabled) return;
    const k = b.dataset.sub!,
      i = RA.sel.indexOf(k);
    if (i >= 0) RA.sel.splice(i, 1);
    else if (RA.sel.length < 3) RA.sel.push(k);
    raRender();
  });
  window.addEventListener(
    "keydown",
    (e) => {
      if (!RA.open) return;
      if (e.code === "Escape") {
        e.stopPropagation();
        raClose(true);
      } else if (e.code === "Space" && (RA.step === "heat" || RA.step === "trace")) {
        e.preventDefault();
        RA.holding = true;
      }
    },
    true,
  );
  window.addEventListener(
    "keyup",
    (e) => {
      if (RA.open && e.code === "Space") RA.holding = false;
    },
    true,
  );
}
function raPt(e: PointerEvent) {
  const cv = document.getElementById("ra-cv")!,
    b = cv.getBoundingClientRect(),
    L = b.width,
    PS = L * 0.38 * 0.95;
  return [(e.clientX - b.left - L / 2) / PS, (e.clientY - b.top - L / 2) / PS];
}
export function runeAbsorbOpen(o: { hero: Hero; rune: Runa; where: string }) {
  const h = o.hero,
    r = o.rune;
  if (!h || !r) return;
  raEnsureDom();
  Object.assign(RA, {
    open: true,
    h,
    r,
    where: o.where,
    step: "prep",
    heat: 0,
    holding: false,
    sketch: [],
    trace: [],
    cur: null,
    sel: [],
    used: [],
    spent: 0,
    fixT: 0,
    res: null,
    bg: null,
    sheet: null,
    last: performance.now(),
  });
  if (o.where === "dungeon") {
    dungeon.modalOpen = true;
    dungeon.keys = {};
    dungeon.joy = null;
    dungeon.guard = false;
    dungeon.charging = false;
  }
  const subs = runeSubsOf(h);
  RA.sel = Object.keys(subs)
    .sort((a, b) => RUNE_SUBS[b].q - RUNE_SUBS[a].q)
    .slice(0, 1);
  document.getElementById("ra-title")!.textContent = "🍃 Absorção · Runa Natural (" + RUNE_EL[r.el].n + ") · " + h.name;
  document.getElementById("ra-modal")!.classList.add("open");
  raRender();
  cancelAnimationFrame(RA.raf!);
  RA.raf = requestAnimationFrame(raLoop);
}
function raClose(cancel: boolean) {
  if (!RA.open) return;
  if (cancel && RA.step === "fix") return; // a energia já está passando — espere
  if (cancel && RA.step !== "result") {
    for (const k of RA.used) runeGive(RA.h, k);
    if (RA.spent)
      itemMsg(
        "Absorção cancelada — a Folhama usada se perdeu" +
          (RA.used.length ? ", os substratos voltaram para a mochila." : "."),
      );
    RA.used = [];
  }
  RA.open = false;
  cancelAnimationFrame(RA.raf!);
  document.getElementById("ra-modal")!.classList.remove("open");
  if (RA.where === "dungeon") {
    dungeon.modalOpen = false;
    if (dungeon.invOpen) renderInv();
  }
  if (RA.where === "mapa" && SEL.runeInspR) {
    const r = runeList().find((q) => q === SEL.runeInspR);
    if (r && document.getElementById("inspector")!.classList.contains("open")) openRuneInspector(r);
  }
  updateEcon();
}
export function raAct(a: string) {
  const h = RA.h;
  if (a === "start") {
    if (runeCount(h, "folhama") < 2 || !RA.sel.length) return;
    RA.step = "heat";
    RA.heat = 0;
  } else if (a === "cancel") raClose(true);
  else if (a === "clr") {
    (RA.step === "sketch" ? RA.sketch : RA.trace).length = 0;
    if (RA.step === "trace") RA.soak = Math.min(1, (RA.soak || 0) * 0.85);
  } else if (a === "skdone" || a === "skskip") {
    if (a === "skskip") RA.sketch.length = 0;
    RA.step = "subs";
  } else if (a === "seal") {
    if (!RA.sel.length) return;
    if (runeCount(h, "folhama") < 1) {
      itemMsg("Falta a segunda folha de Folhama.");
      return;
    }
    runeTake(h, "folhama");
    RA.spent++;
    for (const k of RA.sel) if (runeTake(h, k)) RA.used.push(k);
    if (!RA.used.length) {
      itemMsg("Os substratos sumiram da mochila.");
      return;
    }
    RA.step = "trace";
    RA.wet = 0;
    RA.soak = 0;
    sfx("swing");
  } else if (a === "tracedone") {
    if (!RA.trace.some((s: number[][]) => s.length > 1)) return;
    RA.step = "fix";
    RA.fixT = 0;
    raCompute();
    cineSfx("rune");
  } else if (a === "take") raCollect();
  raRender();
}
export function raCompute() {
  const { h, r } = RA,
    P = runePattern(r.seed),
    dex = (h.attrs && h.attrs.destreza) || 5,
    tol = 0.105 + Math.max(0, dex - 5) * 0.004 + profLv(h, "lapidario") * 0.003;
  const tr = runeScore(P, RA.trace, tol),
    sk = RA.sketch.length ? runeScore(P, RA.sketch, 0.13).s : 0;
  let s = Math.min(1, tr.s + sk * 0.07) * (0.82 + 0.18 * Math.max(0, Math.min(1, r.str)));
  const W = raWetStats();
  s *= (1 - 0.45 * W.dry) * (1 - 0.6 * Math.min(1, RA.soak || 0));
  RA.wetRes = W;
  const best = RA.used.slice().sort((a, b) => RUNE_SUBS[b].q - RUNE_SUBS[a].q)[0],
    Q = RUNE_SUBS[best].q,
    sub = best === "runa_bruta" ? "ametista" : best;
  let tier = s < 0.3 ? null : s < 0.5 ? "fraturada" : Q >= 3 ? "preciosa" : "capturada";
  if (tier && tier !== "fraturada" && r.el === "nularis") tier = "liq";
  RA.res = {
    s,
    cov: tr.cov,
    prec: tr.prec,
    sk,
    best,
    tier,
    key: tier ? runeDefKey(tier, r.el, sub, Math.floor(Math.random() * RUNE_LIQ.length)) : null,
  };
  if (tier) runeDef(RA.res.key!);
}
export function raCollect() {
  /* v5.9.05 — ---- lapidário (runas) ---- */
  const h = RA.h,
    res = RA.res;
  raCollectBase();
  /* v5.9.05 — ---- lapidário (runas) ---- */
  if (h && res) gainSkill(h, "lapidario", res.tier ? 6 + Math.round(res.s * 8) : 2);
}
function raCollectBase() {
  const { h, r, res } = RA;
  if (!res) return;
  const E = RUNE_EL[r.el];
  let msg;
  if (res.tier) {
    const where = runeGive(h, res.key!);
    for (const k of RA.used) if (k !== res.best) runeGive(h, k); // os outros substratos voltam (testados)
    h.runeLore = h.runeLore || {};
    h.runeLore[r.el] = (h.runeLore[r.el] || 0) + 1;
    r.absorbed = true;
    r.str = 0;
    msg = "✨ " + ITEM_DEFS[res.key!].name + (where ? " → " + where : "");
    if (RA.where === "dungeon") {
      const i = dungeon.runes!.indexOf(r);
      if (i >= 0) {
        addRing(r.x, r.y, E.c, 90, 1, 4);
        if (r._m) {
          try {
            glFree(r._m.patch);
            glFree(r._m.glyph);
          } catch (e) {}
        }
        dungeon.runes!.splice(i, 1);
      }
      spawnDungeonToast(msg, dungeon.px, dungeon.py - 46, E.c, 13);
    } else {
      const L = runeList(),
        i = L.indexOf(r);
      if (i >= 0) L.splice(i, 1);
      pushEvent("🍃 " + h.name + " absorveu uma Runa Natural (" + E.n + "): " + ITEM_DEFS[res.key!].name + ".");
      if (h.task) h.task.killsDone = 1;
    }
  } else {
    for (const k of RA.used) runeGive(h, k);
    r.str -= 0.5;
    msg = "A energia se dispersou — a runa enfraqueceu.";
    if (RA.where === "dungeon") spawnDungeonToast(msg, dungeon.px, dungeon.py - 46, "#c9b88a", 12);
    else pushEvent("🍃 " + h.name + ": a absorção falhou. " + msg);
  }
  RA.used = [];
  if (RA.where === "mapa" && h.state === "hunting" && h.task && h.task.targetSpecies === "runa") {
    h.state = "returning";
    updateHeroPanelUI();
  }
  raClose(false);
  if (RA.where === "mapa") {
    document.getElementById("inspector")!.classList.remove("open");
    mvToast(msg);
  }
}
function raRender() {
  if (!RA.open) return;
  const h = RA.h,
    st = RA.step,
    $ = (i: string) => document.getElementById(i),
    f = runeCount(h, "folhama"),
    subs = runeSubsOf(h);
  const idx = { prep: -1, heat: 0, sketch: 2, subs: 3, trace: 5, fix: 6, result: 7 }[st]!;
  $("ra-steps")!.innerHTML = RA_STEPS.map(
    (s, i) => "<li class='" + (i < idx ? "done" : i === idx ? "on" : "") + "'>" + s[1] + "</li>",
  ).join("");
  let p = "",
    b = "";
  if (st === "prep") {
    const names =
      Object.keys(subs)
        .map((k) => icoItem(ITEM_DEFS[k]) + " " + ITEM_DEFS[k].name + " ×" + subs[k])
        .join(", ") || "<i>nenhum</i>";
    p =
      "<p>Pele e animais não podem tocar a runa bruta. A transferência é feita com duas camadas de Folhama, substratos e a agulha.</p><p>🍃 Folhama na mochila: <b>" +
      f +
      "/2</b><br>🪨 Substratos: " +
      names +
      "</p>" +
      (f < 2
        ? "<p class='ra-warn'>Faltam folhas de Folhama — elas aparecem perto das runas na masmorra e são vendidas na preparação da expedição.</p>"
        : "") +
      (!Object.keys(subs).length ? "<p class='ra-warn'>Leve ao menos uma pedra ou minério como substrato.</p>" : "");
    b =
      "<button class='btn pri' data-a='start'" +
      (f < 2 || !Object.keys(subs).length ? " disabled" : "") +
      ">Começar</button><button class='btn' data-a='cancel'>Agora não</button>";
  } else if (st === "heat") {
    p =
      "<p><b>Aquecer de forma indireta e esticar a Folhama</b> sobre a área da runa. Segure até a folha cobrir a runa por inteiro.</p><div class='ra-bar'><i style='width:" +
      Math.round(RA.heat * 100) +
      "%'></i></div>";
    b =
      "<button class='btn pri ra-hold' data-hold='1'>🔥 Segure para aquecer</button><button class='btn' data-a='cancel'>Cancelar</button>";
  } else if (st === "sketch") {
    p =
      "<p><b>Técnica da Lina — molde de vista.</b> A runa ainda aparece através da primeira camada. Faça um esboço fino por cima: depois da segunda camada ele vai te guiar (e aumenta a chance de sucesso).</p>";
    b =
      "<button class='btn pri' data-a='skdone'" +
      (RA.sketch.length ? "" : " disabled") +
      ">✏️ Esboço pronto</button><button class='btn' data-a='clr'>Limpar</button><button class='btn' data-a='skskip'>Pular</button>";
  } else if (st === "subs") {
    p =
      "<p><b>Disponha de 1 a 3 substratos.</b> A energia fixa no <b>melhor</b> deles: pedras semipreciosas e preciosas estabilizam a runa (Runa Preciosa); metais e pedra comum seguram uma versão menos estável. Os outros voltam para a mochila.</p><div class='ra-subs'>" +
      Object.keys(subs)
        .sort((a, c) => RUNE_SUBS[c].q - RUNE_SUBS[a].q)
        .map(
          (k) =>
            "<button class='btn" +
            (RA.sel.includes(k) ? " on" : "") +
            "' data-sub='" +
            k +
            "'" +
            (!RA.sel.includes(k) && RA.sel.length >= 3 ? " disabled" : "") +
            ">" +
            icoItem(ITEM_DEFS[k]) +
            " " +
            ITEM_DEFS[k].name +
            " <small>×" +
            subs[k] +
            " · " +
            "★".repeat(Math.round(RUNE_SUBS[k].q)) +
            "</small></button>",
        )
        .join("") +
      "</div>";
    b =
      "<button class='btn pri' data-a='seal'" +
      (RA.sel.length && f >= 1 ? "" : " disabled") +
      ">🍃 Selar com a 2ª camada</button><button class='btn' data-a='cancel'>Cancelar</button>";
  } else if (st === "trace") {
    p =
      "<p><b>Trace o padrão</b> com a agulha umedecida no agente de liquefação. A runa agora só brilha fraco por baixo das folhas" +
      (RA.sketch.length ? " — siga o seu esboço." : ".") +
      " Pode usar vários traços.</p>" +
      "<p class='ra-wtip'>🫗 <b>Segure para molhar a agulha</b> (ou Espaço) e mantenha na faixa verde. <b>Seca</b>, a marca na folha sai <b>grossa e borrada</b>; <b>molhada demais</b>, a tinta <b>encharca o papel</b>. As duas coisas derrubam a chance de sucesso. Traçar gasta a umidade: molhe de novo no meio.</p>" +
      "<div class='ra-wet'><div class='ra-wz'><i class='dry'></i><i class='ok'></i><i class='soak'></i></div><b id='ra-wmark'></b></div><p class='ra-wst' id='ra-wst'></p>";
    b =
      "<button class='btn' data-hold='1' data-a='dip'>🫗 Molhar a agulha (segure)</button><button class='btn pri' data-a='tracedone'" +
      (RA.trace.some((s: number[][]) => s.length > 1) ? "" : " disabled") +
      ">✅ Concluir traçado</button><button class='btn' data-a='clr'>Apagar traços</button>";
  } else if (st === "fix") {
    p =
      "<p><b>Aguardando a energia fixar</b> no melhor substrato…</p><div class='ra-bar'><i style='width:" +
      Math.round(Math.min(1, RA.fixT / 2.6) * 100) +
      "%'></i></div>";
  } else if (st === "result") {
    const R = RA.res!,
      d = R.key ? ITEM_DEFS[R.key] : null,
      E = RUNE_EL[RA.r.el];
    p =
      "<div class='ra-res'>" +
      (d
        ? "<div class='ra-ico' style='border-color:" +
          d.color +
          "'>" +
          icoItem(d) +
          "</div><div><b>" +
          d.name +
          "</b><br><small>" +
          d.desc +
          "</small></div>"
        : "<div class='ra-ico'>💨</div><div><b>A energia se dispersou</b><br><small>O traçado não acompanhou a runa. Os substratos voltam para a mochila, a Folhama se perdeu e a runa enfraqueceu.</small></div>") +
      "</div>" +
      "<p class='ra-sc'>Precisão do traçado: <b>" +
      Math.round(R.s * 100) +
      "%</b> · cobertura " +
      Math.round(R.cov * 100) +
      "% · firmeza " +
      Math.round(R.prec * 100) +
      "%" +
      (R.sk ? " · esboço " + Math.round(R.sk * 100) + "%" : "") +
      "</p>" +
      (RA.wetRes
        ? "<p class='ra-sc'>🫗 Agulha: " +
          Math.round(RA.wetRes.ok * 100) +
          "% do traço no ponto certo" +
          (RA.wetRes.dry > 0.05 ? " · " + Math.round(RA.wetRes.dry * 100) + "% seco (grosso)" : "") +
          ((RA.soak || 0) > 0.05 ? " · papel " + Math.round(Math.min(1, RA.soak!) * 100) + "% encharcado" : "") +
          "</p>"
        : "") +
      (d
        ? "<p class='ra-sc'>📚 Estudo de runas de " +
          E.n +
          ": " +
          (((h.runeLore || {})[RA.r.el] || 0) + 1) +
          " — base para escrever Runas Comuns no futuro.</p>"
        : "");
    b = "<button class='btn pri' data-a='take'>" + (d ? "📦 Separar e guardar" : "Entendi") + "</button>";
  }
  $("ra-panel")!.innerHTML = p;
  $("ra-btns")!.innerHTML = b;
  $("ra-cvhint")!.textContent =
    st === "sketch"
      ? "✏️ desenhe o esboço por cima do brilho"
      : st === "trace"
        ? "🪡 trace o padrão com o dedo / mouse"
        : "";
}
function raLoop(now: number) {
  if (!RA.open) return;
  RA.raf = requestAnimationFrame(raLoop);
  const dt = Math.min(0.05, (now - RA.last) / 1000);
  RA.last = now;
  if (RA.step === "heat") {
    RA.heat = RA.holding ? Math.min(1, RA.heat + dt / 1.4) : Math.max(0, RA.heat - dt * 0.5);
    const bar = document.querySelector("#ra-panel .ra-bar i") as HTMLElement;
    if (bar) bar.style.width = Math.round(RA.heat * 100) + "%";
    if (RA.heat >= 1) {
      RA.holding = false;
      if (runeTake(RA.h, "folhama")) {
        RA.spent++;
        RA.step = "sketch";
        sfx("swing");
      } else {
        itemMsg("Sem Folhama na mochila.");
        RA.step = "prep";
      }
      raRender();
    }
  }
  if (RA.step === "trace") {
    if (RA.holding) {
      RA.wet = Math.min(1.25, (RA.wet || 0) + dt * 0.6);
      if (!RA._dipS || now - RA._dipS > 380) {
        RA._dipS = now;
        sfx("ping");
      }
    }
    raWetUi();
  }
  if (RA.step === "fix") {
    RA.fixT += dt;
    const bar = document.querySelector("#ra-panel .ra-bar i") as HTMLElement;
    if (bar) bar.style.width = Math.round(Math.min(1, RA.fixT / 2.6) * 100) + "%";
    if (RA.fixT >= 2.6) {
      RA.step = "result";
      sfx(RA.res!.tier && RA.res!.tier !== "fraturada" ? "perfect" : "fail");
      raRender();
    }
  }
  raDraw(now / 1000);
}
function raMakeBg(W: number, seed: number) {
  const c = document.createElement("canvas");
  c.width = c.height = W;
  const g = c.getContext("2d")!,
    R = runeRng(seed + 99);
  const gr = g.createRadialGradient(W / 2, W / 2, W * 0.1, W / 2, W / 2, W * 0.75);
  gr.addColorStop(0, "#3a2a18");
  gr.addColorStop(1, "#140d07");
  g.fillStyle = gr;
  g.fillRect(0, 0, W, W);
  for (let i = 0; i < 260; i++) {
    const x = R() * W,
      y = R() * W,
      L = W * (0.015 + R() * 0.035);
    g.save();
    g.translate(x, y);
    g.rotate(R() * 6.28);
    g.fillStyle = ["#5a3a1e", "#7a4a22", "#8a5a2a", "#4a3320", "#6b7a3a", "#a3692e"][Math.floor(R() * 6)];
    g.globalAlpha = 0.5 + R() * 0.5;
    g.beginPath();
    g.ellipse(0, 0, L, L * 0.45, 0, 0, 6.283);
    g.fill();
    g.restore();
  }
  g.strokeStyle = "rgba(60,40,20,.8)";
  g.lineWidth = W * 0.006;
  for (let i = 0; i < 12; i++) {
    const x = R() * W,
      y = R() * W,
      a = R() * 6.28,
      L = W * (0.04 + R() * 0.08);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L);
    g.stroke();
  }
  return c;
}
function raMakeSheet(W: number, seed: number) {
  // a folha de Folhama: verde, nervuras e pontinhos (como na referência)
  const c = document.createElement("canvas");
  c.width = c.height = W;
  const g = c.getContext("2d")!,
    R = runeRng(seed + 5);
  const gr = g.createLinearGradient(0, 0, W, W);
  gr.addColorStop(0, "#5f8f48");
  gr.addColorStop(0.5, "#4f7d3c");
  gr.addColorStop(1, "#5c8a45");
  g.fillStyle = gr;
  g.beginPath();
  const j = () => (R() - 0.5) * W * 0.03;
  g.moveTo(j(), j());
  g.lineTo(W + j(), j());
  g.lineTo(W + j(), W + j());
  g.lineTo(j(), W + j());
  g.closePath();
  g.fill();
  g.strokeStyle = "rgba(30,55,20,.45)";
  g.lineWidth = W * 0.008;
  g.beginPath();
  g.moveTo(W * 0.05, W * 0.95);
  g.lineTo(W * 0.95, W * 0.05);
  for (let i = 1; i < 9; i++) {
    const t = i / 9,
      x = W * 0.05 + t * W * 0.9,
      y = W * 0.95 - t * W * 0.9;
    g.moveTo(x, y);
    g.lineTo(x - W * 0.16, y - W * 0.16);
    g.moveTo(x, y);
    g.lineTo(x + W * 0.16, y + W * 0.16);
  }
  g.stroke();
  g.fillStyle = "rgba(220,240,180,.18)";
  for (let i = 0; i < 900; i++) {
    g.beginPath();
    g.arc(R() * W, R() * W, W * 0.0035, 0, 6.283);
    g.fill();
  }
  g.fillStyle = "rgba(20,40,10,.18)";
  for (let i = 0; i < 500; i++) {
    g.beginPath();
    g.arc(R() * W, R() * W, W * 0.003, 0, 6.283);
    g.fill();
  }
  return c;
}
function raDrawSub(c: CanvasRenderingContext2D, k: string, x: number, y: number, s: number, glow: number, col: string) {
  c.save();
  c.translate(x, y);
  if (glow > 0) {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, s * 2.4);
    g.addColorStop(0, rgba(col, 0.75 * glow));
    g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, s * 2.4, 0, 6.283);
    c.fill();
  }
  c.lineWidth = Math.max(1, s * 0.08);
  c.strokeStyle = "rgba(0,0,0,.55)";
  const poly = (pts: number[][], fill: string) => {
    c.beginPath();
    pts.forEach((p: number[], i) => (i ? c.lineTo(p[0] * s, p[1] * s) : c.moveTo(p[0] * s, p[1] * s)));
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    c.stroke();
  };
  if (k === "pedra")
    poly(
      [
        [-0.9, 0.3],
        [-0.5, -0.5],
        [0.3, -0.7],
        [0.9, -0.1],
        [0.7, 0.6],
        [-0.2, 0.75],
      ],
      "#8d8a84",
    );
  else if (k === "ferro")
    poly(
      [
        [-0.8, 0.4],
        [-0.6, -0.4],
        [0.2, -0.6],
        [0.85, -0.1],
        [0.6, 0.55],
        [-0.3, 0.7],
      ],
      "#5d626c",
    );
  else if (k === "prata" || k === "lingote") {
    poly(
      [
        [-0.75, -0.75],
        [0.75, -0.75],
        [0.75, 0.75],
        [-0.75, 0.75],
      ],
      k === "prata" ? "#c9d1dc" : "#b8962f",
    );
    c.strokeStyle = "#8a7550";
    for (const [a, b] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      c.beginPath();
      c.arc(a * 0.85 * s, b * 0.85 * s, s * 0.22, 0, 6.283);
      c.stroke();
    }
  } else if (k === "quartzo") {
    poly(
      [
        [0, -1],
        [0.45, -0.3],
        [0.35, 0.8],
        [-0.35, 0.8],
        [-0.45, -0.3],
      ],
      "#bfe9f2",
    );
    c.fillStyle = "rgba(255,255,255,.5)";
    c.fillRect(-0.1 * s, -0.5 * s, 0.12 * s, 1.1 * s);
  } else if (k === "ametista" || k === "runa_bruta") {
    poly(
      [
        [-0.9, 0.5],
        [-0.6, -0.6],
        [0.1, -0.9],
        [0.8, -0.3],
        [0.9, 0.4],
        [0.1, 0.8],
      ],
      "#9b6bd6",
    );
    poly(
      [
        [-0.3, 0.1],
        [0, -0.5],
        [0.4, -0.1],
        [0.1, 0.4],
      ],
      "#c7a3f0",
    );
  } else if (k === "gema") {
    poly(
      [
        [0, -0.85],
        [0.8, -0.15],
        [0, 0.9],
        [-0.8, -0.15],
      ],
      "#3f8fb3",
    );
    poly(
      [
        [0, -0.85],
        [0.35, -0.15],
        [0, 0.4],
        [-0.35, -0.15],
      ],
      "#7fc7e6",
    );
  }
  c.restore();
}
function raDraw(t: number) {
  const cv = document.getElementById("ra-cv") as HTMLCanvasElement;
  if (!cv) return;
  const L = Math.round(cv.getBoundingClientRect().width) || 320,
    dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(L * dpr)) {
    cv.width = cv.height = Math.round(L * dpr);
    RA.bg = null;
    RA.sheet = null;
  }
  const c = cv.getContext("2d")!;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!RA.bg) {
    RA.bg = raMakeBg(Math.round(L * dpr), RA.r.seed);
    RA.sheet = raMakeSheet(Math.round(L * 0.86 * dpr), RA.r.seed);
  }
  c.drawImage(RA.bg, 0, 0, L, L);
  const E = RUNE_EL[RA.r.el],
    P = runePattern(RA.r.seed),
    H = L * 0.38,
    PS = H * 0.95,
    cx = L / 2,
    cy = L / 2,
    st = RA.step,
    pul = 0.75 + 0.25 * Math.sin(t * 2.6);
  const sealed = st === "trace" || st === "fix" || st === "result",
    l1 = st !== "prep" && !(st === "heat"),
    heat = st === "heat" ? RA.heat : l1 ? 1 : 0;
  c.save();
  c.translate(cx, cy);
  // brilho da runa (vai sumindo com as camadas)
  const vis = sealed ? 0.16 : l1 ? 0.6 : 1 - heat * 0.4;
  const g = c.createRadialGradient(0, 0, 0, 0, 0, H * 1.5);
  g.addColorStop(0, rgba(E.c, 0.3 * vis * pul));
  g.addColorStop(1, rgba(E.c, 0));
  c.fillStyle = g;
  c.fillRect(-L / 2, -L / 2, L, L);
  if (!l1) runeLeafPatch(c, H * 0.95, RA.r.seed, 0.55 * (1 - heat));
  runeStrokes(c, P, PS, E.c, 5, 18 * pul, Math.min(1, vis * 1.05));
  runeStrokes(c, P, PS, "#fff4dc", 1.6, 0, vis);
  // 1ª camada (estica enquanto aquece)
  if (heat > 0) {
    const k = 0.72 + 0.28 * heat,
      S = L * 0.43 * k;
    c.save();
    c.globalAlpha = (st === "heat" ? heat : 1) * 0.74;
    c.rotate(-0.02);
    c.drawImage(RA.sheet!, -S, -S, S * 2, S * 2);
    c.restore();
    if (st === "heat" && RA.holding) {
      c.save();
      c.globalCompositeOperation = "lighter";
      for (let i = 0; i < 7; i++) {
        const x = -H + (i / 6) * H * 2,
          a = 0.12 + 0.08 * Math.sin(t * 9 + i);
        c.strokeStyle = "rgba(255,170,90," + a + ")";
        c.lineWidth = 2;
        c.beginPath();
        for (let y = H; y > -H; y -= 8) c.lineTo(x + Math.sin(y * 0.08 + t * 7 + i) * 4, y);
        c.stroke();
      }
      c.restore();
    }
    if (l1) {
      runeStrokes(c, P, PS, E.c, 3.5, 12 * pul, sealed ? 0.08 : 0.42);
    }
  }
  // esboço (molde de vista)
  if (RA.sketch.length) runeStrokes(c, RA.sketch, PS, "#24130a", 2, 0, sealed ? 0.7 : 0.9);
  // substratos
  const subsShow = st === "subs" ? RA.sel : RA.used.length ? RA.used : [];
  const best = RA.res && RA.res.tier ? RA.res.best : null;
  subsShow.forEach((k, i) => {
    const [sx, sy] = RA_SLOTS[i];
    const fixK = st === "fix" ? Math.min(1, RA.fixT / 2.6) : st === "result" ? 1 : 0;
    raDrawSub(c, k, sx * H, sy * H, H * 0.14, k === best ? fixK * pul : 0, E.c);
  });
  // 2ª camada
  if (sealed) {
    const S = L * 0.43;
    c.save();
    c.globalAlpha = 0.55;
    c.rotate(0.025);
    c.drawImage(RA.sheet!, -S, -S, S * 2, S * 2);
    c.restore();
    runeStrokes(c, P, PS, E.c, 4, 10 * pul, 0.13);
    if (RA.sketch.length) runeStrokes(c, RA.sketch, PS, "#24130a", 2, 0, 0.62);
    subsShow.forEach((k, i) => {
      const [sx, sy] = RA_SLOTS[i];
      c.save();
      c.globalAlpha = 0.45;
      raDrawSub(c, k, sx * H, sy * H, H * 0.14, 0, E.c);
      c.restore();
    });
  }
  // traço da agulha
  if (RA.trace.length) {
    const fixK = st === "fix" ? Math.min(1, RA.fixT / 2.6) : st === "result" ? 1 : 0;
    raWetDraw(c, PS);
    runeStrokes(c, RA.trace, PS, E.c, 3 + fixK * 3, 8 + fixK * 18, 0.6 + fixK * 0.4);
    runeStrokes(c, RA.trace, PS, "#eef8ff", 1.6, 0, 0.95);
    if (st === "fix" && best) {
      const [bx, by] = RA_SLOTS[RA.used.indexOf(best)];
      c.save();
      c.globalCompositeOperation = "lighter";
      const pts = runeSamples(RA.trace, 0.12);
      pts.forEach((p, i) => {
        const k = (t * 0.9 + i * 0.037) % 1,
          x = p[0] * PS + (bx * H - p[0] * PS) * k,
          y = p[1] * PS + (by * H - p[1] * PS) * k;
        c.fillStyle = rgba(E.c, 0.7 * (1 - k));
        c.beginPath();
        c.arc(x, y, 2.2, 0, 6.283);
        c.fill();
      });
      c.restore();
    }
  }
  if (st === "sketch" && RA.sketch.length === 0) {
    c.fillStyle = "rgba(255,240,210,.0)";
  }
  c.restore();
  if (st === "trace" || st === "sketch") {
    c.save();
    c.strokeStyle = st === "trace" ? "rgba(200,230,255,.35)" : "rgba(255,230,190,.3)";
    c.setLineDash([5, 6]);
    c.lineWidth = 1;
    c.strokeRect(cx - H, cy - H, H * 2, H * 2);
    c.restore();
  }
}

/* ---- v5.8: umidade da agulha no traçado final ----
   faixa ideal 0,35–0,75. Cada trecho traçado gasta umidade; seco (<0,18) deixa a marca grossa e borrada;
   molhado demais (>0,88) encharca o papel (mancha). Ambos reduzem a chance de sucesso. */
function raWetPt(p: number[], dd: number) {
  if (RA.step !== "trace") return p;
  let w = RA.wet || 0;
  w = Math.max(0, w - dd * RA_WET.use);
  RA.wet = w;
  const st = w < RA_WET.lo ? 1 : w > RA_WET.hi ? 2 : 0;
  if (st === 2) RA.soak = Math.min(1.5, (RA.soak || 0) + dd * (1.2 + (w - RA_WET.hi) * 6));
  if (st === 1 && dd > 0 && Math.random() < 0.25) sfx("fail");
  return [p[0], p[1], st];
}
function raWetStats() {
  let n = 0,
    dry = 0,
    wet = 0;
  for (const s of RA.trace || [])
    for (const q of s) {
      n++;
      if (q[2] === 1) dry++;
      else if (q[2] === 2) wet++;
    }
  return n ? { dry: dry / n, wet: wet / n, ok: (n - dry - wet) / n } : { dry: 0, wet: 0, ok: 1 };
}
function raWetUi() {
  const m = document.getElementById("ra-wmark"),
    st = document.getElementById("ra-wst");
  if (!m) return;
  const w = RA.wet || 0;
  m.style.left = Math.min(100, (w / 1.25) * 100) + "%";
  const sk = Math.min(1, RA.soak || 0);
  m.className = w < RA_WET.lo ? "dry" : w > RA_WET.hi ? "soak" : w >= RA_WET.okLo && w <= RA_WET.okHi ? "ok" : "mid";
  if (st)
    st.textContent =
      (w < RA_WET.lo
        ? "Agulha seca — a marca vai sair grossa"
        : w > RA_WET.hi
          ? "Molhada demais — vai encharcar o papel!"
          : w >= RA_WET.okLo && w <= RA_WET.okHi
            ? "Ponto certo"
            : "Quase…") + (sk > 0.04 ? " · papel " + Math.round(sk * 100) + "% encharcado" : "");
}
function raWetDraw(c: CanvasRenderingContext2D, PS: number) {
  // por baixo do traço: borrões secos e manchas de tinta
  for (const s of RA.trace || [])
    for (let i = 1; i < s.length; i++) {
      const a = s[i - 1],
        b = s[i];
      if (b[2] === 1) {
        c.save();
        c.globalAlpha = 0.55;
        c.strokeStyle = "#1a0e06";
        c.lineWidth = 9;
        c.lineCap = "round";
        c.beginPath();
        c.moveTo(a[0] * PS, a[1] * PS);
        c.lineTo(b[0] * PS, b[1] * PS);
        c.stroke();
        c.restore();
      } else if (b[2] === 2) {
        c.save();
        c.globalAlpha = 0.22;
        c.fillStyle = "#3a5a7a";
        c.beginPath();
        c.arc(b[0] * PS, b[1] * PS, 10 + ((i * 7) % 6), 0, 6.283);
        c.fill();
        c.restore();
      }
    }
  const sk = Math.min(1, RA.soak || 0);
  if (sk > 0.05) {
    c.save();
    c.globalAlpha = 0.28 * sk;
    c.fillStyle = "#2a4058";
    c.beginPath();
    c.arc(0, 0, PS * 0.55, 0, 6.283);
    c.fill();
    c.restore();
  }
}
