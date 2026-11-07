/* ==== Fase 4 — fogueira no campo (v5.9.02) ==== */
import { dungeon, GL3, econ, TELAS } from "../core/state.ts";
import { MB, mbCyl, glMesh, mbIco, gmix, grnd } from "../render/gl/malhas.ts";
import { M4, MALHA } from "../render/gl/geometria.ts";
import { glPush } from "../render/gl/renderer.ts";
import { profLv } from "../hero/proficiencias.ts";
import { ensureInv } from "../items/inventario.ts";
import { qvInv } from "../expedicao/preparo.ts";
import { spawnDungeonToast } from "./masmorra.ts";
import { CT, ctObj, ctMeat, ctPular } from "../intro/tutorial.ts";
import { sfx } from "./chao.ts";
import { aimAngle } from "./acertos.ts";
import { gainSkill } from "../hero/nivel.ts";
import { hvDraw2D } from "./armas.ts";
import type { Hero } from "../core/tipos.ts";

export function dfireGL() {
  const d = dungeon;
  if (!d.fires || !d.fires.length) return;
  if (!GL3.mesh.flame) {
    const b = MB();
    mbCyl(b, M4.S(1, 1, 1), "#ffb43a", 7, 0);
    GL3.mesh.flame = glMesh(b);
    const c2 = MB();
    mbCyl(c2, M4.S(1, 1, 1), "#ff6a1a", 7, 0);
    GL3.mesh.flame2 = glMesh(c2);
  }
  if (!GL3.mesh.fireBase) {
    const b = MB();
    MALHA._gs = 321;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * 6.283;
      mbIco(
        b,
        M4.ch(M4.T(Math.cos(a) * 11, 2, Math.sin(a) * 11), M4.S(5.5, 4.5, 5)),
        gmix("#8d8d88", "#b0afa8", grnd()),
        0,
        0.3,
        0.1,
      );
    }
    for (let i = 0; i < 3; i++)
      mbCyl(
        b,
        M4.ch(M4.T(0, 2, 0), M4.RY(i * 1.05), M4.RZ(Math.PI / 2), M4.T(0, -9, 0), M4.S(2.6, 18, 2.6)),
        "#5e3d1e",
        6,
        1,
      );
    mbIco(b, M4.ch(M4.T(0, 0.8, 0), M4.S(12, 1.6, 12)), "#2a201a", 0, 0.2);
    const m = glMesh(b);
    GL3.mesh.fireBase = m;
  }
  const t = performance.now() / 1000;
  for (const f of d.fires) {
    const k = Math.min(1, f.t / 20);
    glPush(GL3.mesh.fireBase, M4.T(f.x, 0, f.y));
    GL3.fogos.push([f.x, f.y, k]); // v8.0: a luz da fogueira (luzFogueira), cresce com o fogo
    for (let i = 0; i < 4; i++) {
      const a = i * 1.6,
        r = i ? 3.2 : 0,
        hh = (i ? 9 : 14) * (0.8 + 0.25 * Math.sin(t * (9 + i) + i * 2 + f.x)) * (0.4 + 0.6 * k),
        w = i ? 5 : 7;
      glPush(
        i % 2 ? GL3.mesh.flame2 : GL3.mesh.flame,
        M4.ch(M4.T(f.x + Math.cos(a) * r, 2.5, f.y + Math.sin(a) * r), M4.S(w, hh, w)),
        [1, 0.85, 0.4, 0.55],
        false,
      );
      GL3.list[GL3.list.length - 1].brilha = true;
    }
  }
}

export function dfireNear(r?: number) {
  const d = dungeon;
  r = r || d.tile * 1.4;
  return (d.fires || []).find((f) => Math.hypot(f.x - d.px, f.y - d.py) < r) || null;
}

/* ---------------- FOGUEIRA NA MASMORRA (F) ---------------- */
/** Acender com pederneira: o cursor corre e é preciso bater na zona (zc ± zw). */
interface FogoPedra {
  kind: "pedra";
  pos: number;
  dir: number;
  spd: number;
  zc: number;
  zw: number;
  ember: number;
  left: number;
  last: number;
  sparks: { x: number; y: number; vx: number; vy: number; t: number; L: number }[];
  txt: { t: string; c: string; k: number } | null;
  anim: number;
}
/** Acender com o galho (arco de fricção): alternar as teclas esquenta; os braços cansam. */
interface FogoGalho {
  kind: "galho";
  heat: number;
  arms: number;
  lastK: string | null;
  lastT: number;
  last: number;
  smoke: { x: number; y: number; t: number }[];
  rot: number;
  txt: { t: string; c: string; k: number } | null;
  decay: number;
  gain: number;
}
export const FIRE = { open: false, mg: null as FogoPedra | FogoGalho | null, raf: 0 }; // mg: o minijogo aberto (pedra ou galho)
function fireLv() {
  const h = dungeon.active ? dungeon.hero : null;
  return Math.min(5, Math.floor(profLv(h, "sobrevivencia") / 2));
} // v5.9.05: o nível vem da proficiência Sobrevivência
export function invCount(h: Hero, key: string) {
  let n = 0;
  for (const inv of [ensureInv(h), qvInv(h)]) for (const it of inv.items) if (it.def.key === key) n += it.n || 1;
  return n;
}
function invTake(h: Hero, key: string, n: number) {
  for (const inv of [ensureInv(h), qvInv(h)])
    for (const it of inv.items.slice()) {
      if (n <= 0) return;
      if (it.def.key !== key) continue;
      const c = it.n || 1,
        t = Math.min(c, n);
      if (c > t) it.n = c - t;
      else inv.items.splice(inv.items.indexOf(it), 1);
      n -= t;
    }
}
export function fireOpen() {
  const d = dungeon;
  if (!d.active || d.dead || d.invOpen || d.modalOpen || d.camp) return;
  if (dfireNear(d.tile * 2)) {
    spawnDungeonToast("Já tem uma fogueira aqui", d.px, d.py - 30, "#ffe08a", 11);
    return;
  }
  fireEnsureDom();
  FIRE.open = true;
  FIRE.mg = null;
  d.modalOpen = true;
  d.charging = false;
  d.guard = false;
  document.getElementById("fire-modal")!.classList.add("open");
  fireRender();
}
export function fireClose() {
  FIRE.open = false;
  FIRE.mg = null;
  dungeon.modalOpen = false;
  const m = document.getElementById("fire-modal");
  if (m) m.classList.remove("open");
  if (CT.lighting) CT.lighting = false; /* v6.4 */
}
export function fireEnsureDom() {
  if (document.getElementById("fire-modal")) return;
  const m = document.createElement("div");
  m.id = "fire-modal";
  m.className = "v3-modal";
  m.innerHTML =
    '<div class="v3-card" id="fire-card"><div id="fire-head"><b>🔥 Acender fogueira</b><span id="fire-lv"></span><button class="btn" id="fire-x">✕</button></div><div id="fire-body"></div></div>';
  document.body.appendChild(m);
  (m.querySelector("#fire-x") as HTMLElement).onclick = fireClose;
  m.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).id === "fire-pular") {
      ctPular(); // v7.7: pular o tutorial do acampamento (e este minigame) daqui também
      return;
    }
    const b = (e.target as HTMLElement).closest("[data-fa]") as HTMLButtonElement;
    if (b && !b.disabled) fireStart(b.dataset.fa!);
  });
  m.addEventListener("pointerdown", (e) => {
    const b = (e.target as HTMLElement).closest("[data-fk]") as HTMLElement;
    if (b) {
      e.preventDefault();
      fireKey(b.dataset.fk!);
    }
  });
  window.addEventListener(
    "keydown",
    (e) => {
      if (!FIRE.open) return;
      if (e.code === "Escape") {
        e.stopPropagation();
        fireClose();
        return;
      }
      const g = FIRE.mg;
      if (!g) return;
      if (g.kind === "pedra" && e.code === "Space") {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) fireKey("hit");
      } else if (g.kind === "galho" && ["KeyA", "ArrowLeft", "KeyD", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) fireKey(e.code === "KeyA" || e.code === "ArrowLeft" ? "L" : "R");
      } else if (e.code.startsWith("Key") || e.code === "Space") e.stopPropagation();
    },
    true,
  );
}
export function fireRender() {
  const h = dungeon.hero!,
    lv = fireLv(),
    st = invCount(h, "pedra"),
    gw = invCount(h, "galho"),
    B = document.getElementById("fire-body")!,
    auto = lv >= 5;
  document.getElementById("fire-lv")!.textContent = "Nível " + lv + (auto ? " (mestre: acende direto)" : "");
  {
    // v7.7: na fogueira do tutorial do acampamento dá para pular o tutorial (minigame incluído)
    let pul = document.getElementById("fire-pular");
    if (CT.lighting && !pul) {
      pul = document.createElement("button");
      pul.className = "btn";
      pul.id = "fire-pular";
      pul.textContent = "Pular tutorial ⏭";
      document.getElementById("fire-x")!.before(pul);
    }
    if (pul) pul.style.display = CT.lighting ? "" : "none";
  }
  if (FIRE.mg) {
    B.innerHTML =
      '<canvas id="fire-cv" width="440" height="250"></canvas><p class="fire-tip" id="fire-tip"></p><div class="fire-btns" id="fire-btns"></div>';
    fireMgUi();
    return;
  }
  const okP = st >= 2 && gw >= 2,
    okG = gw >= 3;
  B.innerHTML =
    "<p>Fogueira aquece (frio), ajuda os ferimentos a fecharem fora de combate e deixa assar carne (E perto dela). Dura ~2 minutos.</p>" +
    "<div class='fire-opt'><b>🪨 Pederneira</b><small>2 pedras (ficam com você) + 2 galhos de lenha · bata uma pedra na outra no tempo certo para soltar faíscas</small><button class='btn pri' data-fa='pedra'" +
    (okP || econ.test ? "" : " disabled") +
    ">" +
    (auto ? "🔥 Acender" : "Bater as pedras") +
    "</button></div>" +
    "<div class='fire-opt'><b>🪵 Fricção</b><small>3 galhos (1 vira broca) · gire a broca alternando A e D (ou ← →) no ritmo até sair fumaça</small><button class='btn pri' data-fa='galho'" +
    (okG || econ.test ? "" : " disabled") +
    ">" +
    (auto ? "🔥 Acender" : "Girar o graveto") +
    "</button></div>" +
    "<p class='fire-have'>Você tem: 🪨 " +
    st +
    " pedra(s) · 🪵 " +
    gw +
    " galho(s)" +
    (lv ? " · cada fogueira acesa facilita a próxima" : "") +
    "</p>";
}
export function fireStart(kind: string) {
  const lv = fireLv();
  if (lv >= 5) {
    fireDone(kind, true);
    return;
  }
  if (kind === "pedra")
    FIRE.mg = {
      kind,
      pos: 0,
      dir: 1,
      spd: 1.25 - lv * 0.06,
      zc: 0.3 + Math.random() * 0.4,
      zw: 0.07 + lv * 0.025,
      ember: 0,
      left: 12 + lv * 2,
      last: performance.now(),
      sparks: [],
      txt: null,
      anim: 0,
    };
  else
    FIRE.mg = <FogoGalho>{
      kind,
      heat: 0,
      arms: 100,
      lastK: null,
      lastT: 0,
      last: performance.now(),
      smoke: [],
      rot: 0,
      txt: null,
      decay: 11 - lv * 1.6,
      gain: 6.5 + lv * 0.8,
    };
  fireRender();
  cancelAnimationFrame(FIRE.raf);
  FIRE.raf = requestAnimationFrame(fireLoop);
  const cv = document.getElementById("fire-cv");
  if (cv)
    cv.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (FIRE.mg && FIRE.mg.kind === "pedra") fireKey("hit");
    });
}
function fireMgUi() {
  const g = FIRE.mg!,
    t = document.getElementById("fire-tip"),
    b = document.getElementById("fire-btns")!;
  if (!t) return;
  if (g.kind === "pedra") {
    t.innerHTML =
      "Aperte <b>Espaço</b> (ou clique) quando a pedra passar na <b>faixa dourada</b>: a faísca cai na palha. Encha a brasa antes que esfrie. Batidas restantes: <b>" +
      g.left +
      "</b>";
    b.innerHTML = "<button class='btn pri' data-fk='hit'>🪨 Bater</button>";
  } else {
    t.innerHTML =
      "Alterne <b>A</b> e <b>D</b> (ou ← →, ou os botões) num ritmo firme: rápido demais escorrega, devagar demais esfria. Cuidado com o cansaço dos braços.";
    b.innerHTML = "<button class='btn' data-fk='L'>⬅ A</button><button class='btn' data-fk='R'>D ➡</button>";
  }
}
function fireFx(t: string, c: string) {
  FIRE.mg!.txt = { t, c, k: 1 };
}
export function fireKey(k: string) {
  const g = FIRE.mg;
  if (!g) return;
  if (g.kind === "pedra") {
    if (k !== "hit" || g.anim > 0 || g.left <= 0) return;
    g.left--;
    g.anim = 0.2;
    const off = Math.abs(g.pos - g.zc);
    const s = off < g.zw * 0.35 ? 2 : off < g.zw ? 1 : 0;
    g.ember = Math.max(0, g.ember + (s === 2 ? 34 : s === 1 ? 20 : -6));
    for (let i = 0; i < (s ? 14 : 4); i++)
      g.sparks.push({
        x: 0,
        y: 0,
        vx: (Math.random() - 0.3) * 220,
        vy: -40 - Math.random() * 160,
        t: 0,
        L: 0.35 + Math.random() * 0.4,
      });
    fireFx(s === 2 ? "Faísca perfeita!" : s === 1 ? "Faísca!" : "Só barulho…", s ? "#ffd24a" : "#ff8a6a");
    sfx(s ? "hit" : "hitlite");
    g.zc = 0.22 + Math.random() * 0.56;
    g.spd *= 1.04;
    if (g.ember >= 100) fireDone("pedra");
    else if (g.left <= 0) fireFail("As pedras não pegaram fogo.");
    else fireMgUi();
    return;
  }
  if (k !== "L" && k !== "R") return;
  const now = performance.now() / 1000,
    dtk = now - g.lastT;
  if (g.lastK === k) {
    g.heat = Math.max(0, g.heat - 8);
    fireFx("Escorregou!", "#ff8a6a");
    sfx("hitlite");
  } else if (g.lastK && dtk < 0.09) {
    g.heat = Math.max(0, g.heat - 5);
    fireFx("Rápido demais!", "#ff8a6a");
  } else if (!g.lastK || dtk < 0.45) {
    g.heat = Math.min(100, g.heat + g.gain * (dtk > 0.12 && dtk < 0.3 ? 1.25 : 1));
    g.rot += k === "L" ? -1 : 1;
    if (Math.random() < 0.35) sfx("hitlite");
  }
  g.lastK = k;
  g.lastT = now;
  g.arms = Math.max(0, g.arms - 1.6);
  if (g.heat >= 100) fireDone("galho");
}
function fireLoop(now: number) {
  const g = FIRE.mg;
  if (!g || !FIRE.open) return;
  FIRE.raf = requestAnimationFrame(fireLoop);
  const dt = Math.min(0.05, (now - g.last) / 1000);
  g.last = now;
  if (g.kind === "pedra") {
    g.pos += g.dir * g.spd * dt;
    if (g.pos > 1) {
      g.pos = 1;
      g.dir = -1;
    }
    if (g.pos < 0) {
      g.pos = 0;
      g.dir = 1;
    }
    g.ember = Math.max(0, g.ember - dt * 7);
    if (g.anim > 0) g.anim -= dt;
    for (const s of g.sparks) {
      s.t += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 420 * dt;
    }
    g.sparks = g.sparks.filter((s) => s.t < s.L);
  } else {
    g.heat = Math.max(0, g.heat - g.decay * dt);
    g.arms = Math.min(100, g.arms + (now / 1000 - g.lastT > 0.6 ? 9 : 0) * dt);
    if (g.arms <= 0) {
      fireFail("Os braços cansaram.");
      return;
    }
    if (g.heat > 40 && Math.random() < (dt * g.heat) / 12) g.smoke.push({ x: (Math.random() - 0.5) * 10, y: 0, t: 0 });
    for (const s of g.smoke) {
      s.t += dt;
      s.y -= 28 * dt;
      s.x += Math.sin(s.t * 3) * 8 * dt;
    }
    g.smoke = g.smoke.filter((s) => s.t < 1.6);
  }
  if (g.txt) g.txt.k -= dt * 0.9;
  fireDraw(now / 1000);
}
function fireDraw(_t: number) {
  const g = FIRE.mg!,
    cv = document.getElementById("fire-cv") as HTMLCanvasElement;
  if (!cv) return;
  const c = cv.getContext("2d")!,
    W = cv.width,
    H = cv.height;
  c.fillStyle = "#17110b";
  c.fillRect(0, 0, W, H);
  c.fillStyle = "#3a2c1c";
  c.beginPath();
  c.ellipse(W / 2, H - 46, 150, 26, 0, 0, 6.283);
  c.fill();
  const tx = W / 2,
    ty = H - 58; // palha
  c.fillStyle = "#c9a24a";
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * 6.283;
    c.save();
    c.translate(tx + Math.cos(a) * 16, ty + Math.sin(a) * 6);
    c.rotate(a + 1.2);
    c.fillRect(-10, -1, 20, 2);
    c.restore();
  }
  if (g.kind === "pedra") {
    const e = g.ember / 100,
      gl = c.createRadialGradient(tx, ty, 1, tx, ty, 10 + 36 * e);
    gl.addColorStop(0, "rgba(255,160,50," + (0.25 + 0.7 * e) + ")");
    gl.addColorStop(1, "rgba(255,90,20,0)");
    c.fillStyle = gl;
    c.beginPath();
    c.arc(tx, ty, 10 + 36 * e, 0, 6.283);
    c.fill();
    const k = g.anim > 0 ? Math.sin((g.anim / 0.2) * Math.PI) : 0,
      sx = tx - 60 + k * 30;
    c.fillStyle = "#8d8d88";
    c.beginPath();
    c.ellipse(sx, ty - 64, 20, 14, -0.4, 0, 6.283);
    c.fill();
    c.fillStyle = "#6f6f6a";
    c.beginPath();
    c.ellipse(tx + 34, ty - 52, 22, 15, 0.3, 0, 6.283);
    c.fill();
    c.save();
    c.globalCompositeOperation = "lighter";
    for (const s of g.sparks) {
      c.fillStyle = "rgba(255,210,90," + (1 - s.t / s.L) + ")";
      c.fillRect(tx + 10 + s.x, ty - 58 + s.y, 2.4, 2.4);
    }
    c.restore();
    const bx = 30,
      bw = W - 60,
      by = 18;
    c.fillStyle = "rgba(0,0,0,.5)";
    c.fillRect(bx, by, bw, 12);
    c.fillStyle = "rgba(255,210,74,.35)";
    c.fillRect(bx + bw * (g.zc - g.zw), by, bw * g.zw * 2, 12);
    c.fillStyle = "rgba(255,240,170,.8)";
    c.fillRect(bx + bw * (g.zc - g.zw * 0.35), by, bw * g.zw * 0.7, 12);
    c.fillStyle = "#fff";
    c.fillRect(bx + bw * g.pos - 2, by - 4, 4, 20);
    c.fillStyle = "rgba(0,0,0,.5)";
    c.fillRect(W - 26, 44, 12, H - 100);
    c.fillStyle = "#ff8a2a";
    c.fillRect(W - 24, 44 + (H - 100) * (1 - e), 8, (H - 100) * e);
    c.fillStyle = "#e9dcc0";
    c.font = "11px Lora,serif";
    c.textAlign = "center";
    c.fillText("brasa", W - 20, H - 44);
  } else {
    const e = g.heat / 100;
    c.save();
    c.translate(tx, ty - 6);
    c.fillStyle = "#6a4524";
    c.fillRect(-30, 0, 60, 8);
    c.rotate(Math.sin(g.rot * 0.9) * 0.08);
    c.fillStyle = "#8a6038";
    c.fillRect(-3, -80, 6, 82);
    c.fillStyle = "#5a3a1e";
    c.fillRect(-26, -84, 52, 6);
    c.restore();
    const gl = c.createRadialGradient(tx, ty, 1, tx, ty, 8 + 26 * e);
    gl.addColorStop(0, "rgba(255,140,40," + (0.1 + 0.8 * e * e) + ")");
    gl.addColorStop(1, "rgba(255,80,20,0)");
    c.fillStyle = gl;
    c.beginPath();
    c.arc(tx, ty, 8 + 26 * e, 0, 6.283);
    c.fill();
    for (const s of g.smoke) {
      c.fillStyle = "rgba(200,200,200," + 0.35 * (1 - s.t / 1.6) + ")";
      c.beginPath();
      c.arc(tx + s.x, ty - 10 + s.y, 5 + s.t * 8, 0, 6.283);
      c.fill();
    }
    const bar = (x: number, v: number, col: string | CanvasGradient | CanvasPattern, lab: string) => {
      c.fillStyle = "rgba(0,0,0,.5)";
      c.fillRect(x, 30, 12, H - 90);
      c.fillStyle = col;
      c.fillRect(x + 2, 30 + (H - 90) * (1 - v / 100), 8, ((H - 90) * v) / 100);
      c.fillStyle = "#e9dcc0";
      c.font = "11px Lora,serif";
      c.textAlign = "center";
      c.fillText(lab, x + 6, H - 46);
    };
    bar(W - 30, g.heat, "#ff8a2a", "calor");
    bar(18, g.arms, "#7dc8ff", "braços");
    c.fillStyle = "#c9b88a";
    c.font = "bold 18px Lora,serif";
    c.textAlign = "center";
    c.fillText(g.lastK === "L" ? "→ agora D" : "→ agora A", W / 2, 26);
  }
  if (g.txt && g.txt.k > 0) {
    c.save();
    c.globalAlpha = Math.min(1, g.txt.k * 1.5);
    c.fillStyle = g.txt.c;
    c.font = "bold 16px Cinzel,serif";
    c.textAlign = "center";
    c.shadowColor = "#000";
    c.shadowBlur = 6;
    c.fillText(g.txt.t, W / 2, 58);
    c.restore();
  }
}
function fireFail(msg: string) {
  const B = document.getElementById("fire-body")!;
  FIRE.mg = null;
  cancelAnimationFrame(FIRE.raf);
  sfx("fail");
  fireRender();
  const p = document.createElement("p");
  p.className = "fire-fail";
  p.textContent = "💨 " + msg + " Tente de novo.";
  B.prepend(p);
}
function fireDone(kind: string, auto?: boolean) {
  /* v6.4 — a primeira fogueira, no tutorial do acampamento */
  if (CT.lighting) {
    const d = dungeon,
      h = d.hero!;
    if (!econ.test) invTake(h, "galho", kind === "pedra" ? 2 : 3);
    econ.fireLv = Math.min(5, (econ.fireLv! | 0) + 1);
    FIRE.mg = null;
    cancelAnimationFrame(FIRE.raf);
    CT.lighting = false;
    fireClose();
    CT.unlit = false;
    sfx("perfect");
    spawnDungeonToast("🔥 Fogueira acesa!", d.px, d.py - 44, "#ffb347", 14);
    ctObj("", "");
    setTimeout(ctMeat, 900);
    return;
  }
  const h = dungeon.hero; // v5.9.05 — acender treina Sobrevivência (o nível da fogueira vem dela, ver fireLv)
  {
    const d = dungeon,
      h = d.hero!;
    if (!econ.test) {
      if (kind === "pedra") invTake(h, "galho", 2);
      else invTake(h, "galho", 3);
    }
    const a = aimAngle(),
      T = d.tile;
    d.fires = d.fires || [];
    d.fires.push({
      x: Math.max(T, Math.min(d.cols * T - T, d.px + Math.cos(a) * T * 0.9)),
      y: Math.max(T, Math.min(d.rows * T - T, d.py + Math.sin(a) * T * 0.9)),
      t: 130,
      max: 130,
    });
    const up = (econ.fireLv! | 0) < 5;
    econ.fireLv = Math.min(5, (econ.fireLv! | 0) + 1);
    FIRE.mg = null;
    cancelAnimationFrame(FIRE.raf);
    fireClose();
    sfx("perfect");
    spawnDungeonToast(
      "🔥 Fogueira acesa!" + (up && !auto ? " (nível " + fireLv() + ")" : ""),
      d.px,
      d.py - 44,
      "#ffb347",
      13,
    );
  }
  econ.fireLv = 0;
  if (h) gainSkill(h, "sobrevivencia", auto ? 3 : 8);
}
export function dfireTick(dt: number) {
  const d = dungeon;
  if (!d.active || !d.fires) return;
  for (const f of d.fires) f.t -= dt;
  d.fires = d.fires.filter((f) => f.t > 0);
  const f = dfireNear(d.tile * 2.8);
  if (f && d.hero && !d.dead) {
    if (d.sinceHurt! > 4 && (d.wound || 0) > 0 && (d.hero.hunger || 0) <= 60) d.wound = Math.max(0, d.wound! - dt / 5);
  }
}
/* luz das fogueiras e golpes carregados no 2D (armasDraw2D chama) */
export function dfireDraw2D() {
  const d = dungeon,
    c = TELAS.dCtx,
    t = performance.now() / 1000;
  for (const f of d.fires || []) {
    const r = d.tile * (2.6 + 0.1 * Math.sin(t * 5));
    const gr = c.createRadialGradient(f.x, f.y, 4, f.x, f.y, r);
    gr.addColorStop(0, "rgba(255,170,60,.28)");
    gr.addColorStop(1, "rgba(255,120,40,0)");
    c.fillStyle = gr;
    c.beginPath();
    c.arc(f.x, f.y, r, 0, 6.283);
    c.fill();
  }
  hvDraw2D();
}
