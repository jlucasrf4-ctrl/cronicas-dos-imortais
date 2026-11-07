/* ==== Fase 4 — cozinha: assar a carne (v5.9, v5.9.07, v5.9.15) ==== */
import { audioCtx, _out } from "../audio/som.ts";
import { COOK } from "../data/sobrevivencia.ts";
import { icoHas, icoImg } from "../ui/icones.ts";
import { sfx, renderInv } from "../field/chao.ts";
import { CAMP, campClose, campRender } from "./acampamento.ts";
import type { Cozimento } from "./acampamento.ts";
import { CT, ctObj, ctTent } from "../intro/tutorial.ts";
import { dungeon, world, econ } from "../core/state.ts";
import { gainSkill } from "../hero/nivel.ts";
import { mvToast } from "../ui/avisos.ts";
import { mkItem, placeIn } from "../items/equipamento.ts";
import { ensureInv, TIERS } from "../items/inventario.ts";
import { pushEvent } from "../sim/eventos.ts";
import { itemMsg } from "../field/masmorra.ts";

/* ==== carne assada: brilho, chiado e animação ==== */
export function sizzle(dur: number, vol: number) {
  try {
    const ac = audioCtx(),
      t0 = ac.currentTime,
      n = Math.floor(ac.sampleRate * dur),
      buf = ac.createBuffer(1, n, ac.sampleRate),
      d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const env = Math.min(1, i / (ac.sampleRate * 0.05)) * Math.pow(1 - i / n, 1.4);
      d[i] = (Math.random() * 2 - 1) * env * (Math.random() < 0.02 ? 3 : 0.6);
    }
    const src = ac.createBufferSource(),
      f = ac.createBiquadFilter(),
      g = ac.createGain();
    f.type = "highpass";
    f.frequency.value = 2400;
    g.gain.value = vol || 0.25;
    src.buffer = buf;
    src.connect(f);
    f.connect(g);
    g.connect(_out());
    src.start(t0);
  } catch (_) {}
}
function chime(good: boolean) {
  try {
    const ac = audioCtx(),
      t = ac.currentTime,
      notes = good ? [523, 659, 784, 1047] : [392, 494];
    notes.forEach((fq, i) => {
      const o = ac.createOscillator(),
        g = ac.createGain();
      o.type = "triangle";
      o.frequency.value = fq;
      g.gain.setValueAtTime(0, t + i * 0.09);
      g.gain.linearRampToValueAtTime(0.16, t + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.5);
      o.connect(g);
      g.connect(_out());
      o.start(t + i * 0.09);
      o.stop(t + i * 0.09 + 0.55);
    });
  } catch (_) {}
}
function cookSplash(s: Pick<Cozimento, "a" | "b" | "an">) {
  const ok = (v: number) => v >= COOK.ok[0] && v <= COOK.ok[1],
    burnt = s.a > COOK.burn || s.b > COOK.burn,
    perfect = !burnt && ok(s.a) && ok(s.b);
  const card = document.body;
  let el = document.getElementById("cook-splash");
  if (el) el.remove();
  el = document.createElement("div");
  el.id = "cook-splash";
  el.className = burnt ? "burnt" : perfect ? "perfect" : "good";
  const ico = "cooked_" + s.an;
  el.innerHTML =
    "<div class='cs-rays'></div><div class='cs-glow'></div>" +
    (icoHas(ico) ? "<i class='ic ico-" + ico + " cs-meat'></i>" : "<div class='cs-meat cs-emo'>🍖</div>") +
    Array.from(
      { length: burnt ? 0 : perfect ? 10 : 5 },
      (_, i) =>
        "<span class='cs-sp' style='--a:" +
        (i * 36 + Math.random() * 20) +
        "deg;--d:" +
        (0.15 + Math.random() * 0.35) +
        "s'>✦</span>",
    ).join("") +
    Array.from(
      { length: 4 },
      (_, i) => "<span class='cs-steam' style='--x:" + (-30 + i * 20) + "px;--d:" + i * 0.18 + "s'></span>",
    ).join("") +
    "<div class='cs-txt'>" +
    (burnt ? "Queimou um pouco…" : perfect ? "✨ Ao ponto! Perfeita!" : "🍖 Assada!") +
    "</div>";
  card.appendChild(el);
  sizzle(perfect ? 1.1 : 0.8, burnt ? 0.18 : 0.26);
  setTimeout(() => chime(!burnt), 180);
  setTimeout(() => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 450);
  }, 2300);
  el.addEventListener("click", () => el.remove());
}

/* galhos pegos no acampamento viram lenha */
/* ---- minigame: assar a carne ---- */
export function cookFlip() {
  const k = CAMP.cook;
  if (!k) return;
  k.down = k.down === "a" ? "b" : "a";
  k.flipT = 0.25;
  sfx("swing");
}
export function cookBind() {
  const up = document.getElementById("cook-up");
  if (up) {
    up.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (CAMP.cook) CAMP.cook.up = true;
    });
    for (const ev of ["pointerup", "pointerleave", "pointercancel"])
      up.addEventListener(ev, () => {
        if (CAMP.cook) CAMP.cook.up = false;
      });
  }
  const cv = document.getElementById("cook-cv");
  if (cv) cv.addEventListener("pointerdown", () => cookFlip());
  if (!CAMP.raf) {
    const loop = (now: number) => {
      if (!CAMP.cook || !CAMP.open) {
        CAMP.raf = null;
        return;
      }
      CAMP.raf = requestAnimationFrame(loop);
      cookStep(now);
    };
    CAMP.raf = requestAnimationFrame(loop);
  }
}
export function cookStep(now: number) {
  const k = CAMP.cook!,
    dt = Math.min(0.05, (now - k.last) / 1000);
  k.last = now;
  k.t += dt;
  k.ht -= dt;
  if (k.ht <= 0) {
    k.ht = 0.8 + Math.random() * 1.6;
    k.flare = Math.random() < 0.3 ? 1 : 0;
  } // a chama varia; às vezes sobe forte
  const target = k.flare ? 2.1 : 0.7 + Math.random() * 0.6;
  k.heat += (target - k.heat) * Math.min(1, dt * 3);
  const rate = COOK.rate * k.heat * (k.up ? 0.3 : 1);
  k[k.down] = Math.min(1.4, k[k.down] + rate * dt);
  const other = k.down === "a" ? "b" : "a";
  k[other] = Math.min(1.4, k[other] + rate * 0.12 * dt);
  if (k.flipT! > 0) k.flipT! -= dt;
  cookDraw();
}
function cookCol(v: number) {
  return v > COOK.burn
    ? gmixC("#3a2416", "#111", Math.min(1, (v - COOK.burn) * 3))
    : v > COOK.ok[0]
      ? "#8a4a22"
      : v > 0.45
        ? gmixC("#c76a4a", "#8a4a22", (v - 0.45) / 0.27)
        : gmixC("#e88a8a", "#c76a4a", v / 0.45);
}
function gmixC(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)),
    A = p(a),
    B = p(b);
  t = Math.max(0, Math.min(1, t));
  return "rgb(" + A.map((x, i) => Math.round(x + (B[i] - x) * t)).join(",") + ")";
}
export function cookDraw() {
  const cv = document.getElementById("cook-cv") as HTMLCanvasElement;
  if (cv) {
    const c = cv.getContext("2d")!,
      k = CAMP.cook!,
      W = cv.width,
      H = cv.height,
      t = performance.now() / 1000;
    c.fillStyle = "#1a120a";
    c.fillRect(0, 0, W, H);
    const fy = H - 40,
      fh = 40 + k.heat * 38;
    for (let i = 0; i < 9; i++) {
      const x = W / 2 - 80 + i * 20,
        hh = fh * (0.6 + 0.4 * Math.sin(t * 9 + i * 1.7));
      const g = c.createLinearGradient(0, fy, 0, fy - hh);
      g.addColorStop(0, "#ff5a1a");
      g.addColorStop(0.6, "#ffb43a");
      g.addColorStop(1, "rgba(255,230,120,0)");
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(x - 12, fy);
      c.quadraticCurveTo(x, fy - hh * 1.2, x + 12, fy);
      c.fill();
    }
    c.fillStyle = "#4a2e16";
    for (let i = 0; i < 4; i++) c.fillRect(W / 2 - 90 + i * 45, fy, 40, 10);
    const my = k.up ? 70 : 105;
    c.strokeStyle = "#8a6a3a";
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(40, my);
    c.lineTo(W - 40, my);
    c.stroke();
    const flip = k.flipT! > 0 ? Math.sin(((0.25 - k.flipT!) / 0.25) * Math.PI) : 0,
      sideTop = k.down === "a" ? k.b : k.a,
      sideBot = k.down === "a" ? k.a : k.b;
    c.save();
    c.translate(W / 2, my);
    c.scale(1, 1 - flip * 0.8);
    c.fillStyle = cookCol(sideBot);
    c.beginPath();
    c.ellipse(0, 6, 62, 26, 0, 0, Math.PI);
    c.fill();
    c.fillStyle = cookCol(sideTop);
    c.beginPath();
    c.ellipse(0, 6, 62, 26, 0, Math.PI, 6.283);
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = "#2b1d10";
    c.beginPath();
    c.ellipse(0, 6, 62, 26, 0, 0, 6.283);
    c.stroke();
    c.restore();
    if (k.flare) {
      c.fillStyle = "rgba(255,120,40,.18)";
      c.fillRect(0, 0, W, H);
      c.fillStyle = "#ffb37a";
      c.font = "bold 14px Lora, serif";
      c.textAlign = "center";
      c.fillText("A chama subiu! Afaste (↑)", W / 2, 22);
    }
    const bar = (x: number, v: number, lab: string) => {
      c.fillStyle = "#2b2113";
      c.fillRect(x, 40, 16, 140);
      const y0 = 180,
        sc = 140 / 1.4;
      c.fillStyle = "rgba(63,138,58,.6)";
      c.fillRect(x, y0 - COOK.ok[1] * sc, 16, (COOK.ok[1] - COOK.ok[0]) * sc);
      c.fillStyle = "rgba(160,40,30,.6)";
      c.fillRect(x, 40, 16, y0 - COOK.burn * sc - 40);
      c.fillStyle = cookCol(v);
      c.fillRect(x + 3, y0 - v * sc, 10, v * sc);
      c.fillStyle = "#f3e6c8";
      c.font = "11px Lora, serif";
      c.textAlign = "center";
      c.fillText(lab, x + 8, 196);
    };
    bar(14, k.a, "lado A");
    bar(W - 30, k.b, "lado B");
    c.fillStyle = "#c9b88a";
    c.font = "11px Lora, serif";
    c.textAlign = "center";
    c.fillText("no fogo: lado " + (k.down === "a" ? "A" : "B"), W / 2, H - 8);
  }
  try {
    cookDrawCarne();
  } catch (_) {} // v5.9.07
}
export function cookFinish() {
  const tut = CT.stage === "cook"; // v6.5 — tutorial
  const k = CAMP.cook;
  const snap = k ? { a: k.a, b: k.b, an: k.an || "javali" } : null; // v5.9.15 — para o respingo
  const had = !!CAMP.cook; // v5.9.05 — Sobrevivência
  cookFinishBase();
  if (had && !CAMP.cook) {
    const h = (dungeon.active && dungeon.hero) || world.heroes[0];
    if (h) gainSkill(h, "sobrevivencia", 4);
  }
  try {
    if (snap && !CAMP.cook) cookSplash(snap);
  } catch (_) {} // v5.9.15 — respingo de carne assada
  try {
    if (CT.stage === "cook" && !CAMP.cook) {
      CT.stage = "tent";
      ctObj("", "");
      setTimeout(ctTent, 2900);
    }
  } catch (_) {} // v6.4 — tutorial: vai para a barraca
  try {
    if (tut && CT.stage === "tent")
      setTimeout(() => {
        try {
          if (CAMP.open) campClose();
          const m = document.getElementById("camp-modal");
          if (m) m.classList.remove("open");
        } catch (_) {}
      }, 2400);
  } catch (_) {} // v6.5 — tutorial: fecha a janela de cozinhar
}
function cookFinishBase() {
  const k = CAMP.cook;
  if (!k) return;
  const ok = (v: number) => v >= COOK.ok[0] && v <= COOK.ok[1],
    burnt = k.a > COOK.burn || k.b > COOK.burn,
    raw = k.a < 0.45 || k.b < 0.45;
  let tier, msg;
  if (burnt) {
    tier = 0;
    msg = "Queimou um lado — ainda dá para comer.";
  } else if (raw) {
    CAMP.cook!.msgT = 1;
    mvToast("Ainda está crua — deixe mais um pouco.");
    return;
  } else if (ok(k.a) && ok(k.b)) {
    tier = 2;
    msg = "Ao ponto! Carne assada perfeita.";
  } else {
    tier = 1;
    msg = "Mal passada de um lado, mas boa.";
  }
  const it = mkItem("carne_assada", tier);
  it.n = 1;
  it.an = k.an;
  it.qc = k.tier | 0; // v7.7: a qualidade da carne crua também conta no quanto ela cura (valorComida)
  const h = (dungeon.active && dungeon.hero) || world.heroes[0];
  let where = "a mochila";
  if (!placeIn(ensureInv(h), it)) {
    where = "o baú";
    placeIn(econ.stash, it) || pushEvent("Sem espaço para guardar a carne assada.");
  }
  renderInv(); // v7.7: com a mochila aberta, a carne assada aparece nela na hora
  pushEvent(
    "🔥 Na fogueira: " + msg + " (Carne Assada " + (TIERS[tier] ? TIERS[tier].lab : "") + ") — foi para " + where + ".",
  );
  itemMsg("🍖 " + msg + " (foi para " + where + ")");
  sfx(tier >= 2 ? "perfect" : "ping");
  CAMP.cook = null;
  campRender();
}

/* ==== assar: a peça de carne desenhada (crua → assada, conforme os dois lados) ==== */
/* carne pintada (crua → assada) por cima do minigame (cookDraw chama) */
function cookDrawCarne() {
  const k = CAMP.cook,
    cv = document.getElementById("cook-cv") as HTMLCanvasElement;
  if (!k || !cv) return;
  const c = cv.getContext("2d")!,
    W = cv.width,
    my = k.up ? 70 : 105,
    an = k.an || "javali";
  const raw = icoImg("meat_" + an + "_" + Math.min(5, 1 + (k.tier | 0) * 2)) || icoImg("meat_" + an + "_1"),
    ck = icoImg("cooked_" + an);
  if (!raw && !ck) return;
  const flip = k.flipT! > 0 ? Math.sin(((0.25 - k.flipT!) / 0.25) * Math.PI) : 0,
    p = Math.max(0, Math.min(1, ((k.a + k.b) / 2 - 0.2) / 0.65)),
    burn = Math.max(0, Math.max(k.a, k.b) - COOK.burn);
  c.save();
  c.translate(W / 2, my + 4);
  c.scale(1, 1 - flip * 0.8);
  const S = 150;
  if (raw) {
    c.globalAlpha = 1 - p;
    c.drawImage(raw, -S / 2, -S / 2 - 6, S, S);
  }
  if (ck) {
    c.globalAlpha = p;
    if (burn > 0) c.filter = "brightness(" + Math.max(0.25, 1 - burn * 3) + ")";
    c.drawImage(ck, -S / 2, -S / 2 - 6, S, S);
    c.filter = "none";
  }
  c.restore();
}
