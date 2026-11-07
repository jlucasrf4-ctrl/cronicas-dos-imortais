/* ==== Fase 4 — código de carga do antigo src/js/modulos/v5.9.04_tamandua.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarTamandua() na ordem do antigo manifesto. */
import { dungeon, world } from "../../core/state.ts";
import { MP, mnt, mountDay, mountNear, mountToggle, mountXp } from "../../creatures/tamandua.ts";
import { fireOpen } from "../../field/fogueira.ts";
import { WORLD_SAVE_KEYS } from "../../save/salvar.ts";
import { GS, GS_CODES, gsOpen, gsRun } from "../../ui/gameshark.ts";

export function iniciarTamandua() {
  /* ---------- desenho 2D (mapa) ---------- */
  setTimeout(() => {
    try {
      if (!WORLD_SAVE_KEYS.includes("anteaters")) WORLD_SAVE_KEYS.push("anteaters");
    } catch (_) {}
  }, 0);

  /* ---------- PAINEL do tamanduá (acampamento / mapa) ---------- */

  setInterval(() => {
    try {
      const m = mnt();
      if (!m || !m.with) return;
      const h = world.heroes.find((x) => x.id === m.with);
      if (!h) {
        m.with = null;
        return;
      }
      if (MP._ls && MP._ls !== "idle" && h.state === "idle" && MP._ls !== "indungeon") mountXp(1, "viajou junto");
      MP._ls = h.state;
    } catch (_) {}
  }, 1000);

  /* ---------- MASMORRA / ACAMPAMENTO: companheiro e montaria ---------- */
  window.addEventListener("keydown", (e) => {
    if (
      e.code === "KeyT" &&
      dungeon.active &&
      !e.repeat &&
      !(e.target && (e.target as HTMLElement).tagName === "INPUT")
    )
      mountToggle();
  });
  setTimeout(function mbtn() {
    const herb = document.getElementById("dungeon-herb");
    if (!herb) {
      setTimeout(mbtn, 800);
      return;
    }
    if (document.getElementById("dungeon-mount")) return;
    const b = document.createElement("button");
    b.className = "btn";
    b.id = "dungeon-mount";
    b.innerHTML = "🐾<kbd>T</kbd>"; // v7.7: HUD compacta (o nome vai no title)
    b.title = "Montaria (T)";
    b.onclick = () => mountToggle();
    herb.after(b);
  }, 500);
  setInterval(() => {
    const b = document.getElementById("dungeon-mount");
    if (b) b.style.display = dungeon.active && dungeon.mount ? "" : "none";
  }, 700);

  /* ---------- 🎮 GAMESHARK (códigos de teste) ---------- */
  window.addEventListener("keydown", (e) => {
    if (
      (e.target &&
        ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA")) ||
      dungeon.active ||
      !/^Key[A-Z]$/.test(e.code)
    )
      return;
    GS.buf = (GS.buf + e.code.slice(3)).slice(-12);
    for (const c in GS_CODES)
      if (GS.buf.endsWith(c)) {
        GS.buf = "";
        gsRun(c);
        break;
      }
  });
  setTimeout(function gsb() {
    const tt = document.getElementById("test-tools");
    if (!tt) {
      setTimeout(gsb, 800);
      return;
    }
    if (document.getElementById("tt-gs")) return;
    const b = document.createElement("button");
    b.className = "btn";
    b.id = "tt-gs";
    b.textContent = "🎮 GameShark";
    b.onclick = gsOpen;
    tt.appendChild(b);
  }, 500);
  /* ---------- celular: botões de toque para montar/assobiar e fogueira ---------- */
  setInterval(() => {
    try {
      const cl = document.getElementById("tb-cluster"),
        top = document.getElementById("tb-top");
      if (!cl) return;
      let b = document.getElementById("tb-mount");
      if (!b) {
        b = document.createElement("button");
        b.id = "tb-mount";
        b.className = "tb";
        b.innerHTML = "🐾<small>montar</small>";
        b.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          mountToggle();
        });
        cl.appendChild(b);
      }
      let f = document.getElementById("tb-fire");
      if (!f && top) {
        f = document.createElement("button");
        f.id = "tb-fire";
        f.className = "tb sm";
        f.textContent = "🔥";
        f.addEventListener("click", () => {
          fireOpen();
        });
        top.appendChild(f);
      }
      const d = dungeon,
        M = d.mount,
        show = !!(d.active && M);
      b.style.display = show ? "" : "none";
      if (show) {
        const near = !M.mounted && mountNear();
        b.innerHTML = M.mounted
          ? "🐾<small>descer</small>"
          : near
            ? "🐾<small>montar</small>"
            : "🎵<small>chamar</small>";
        b.classList.toggle("hot", near!);
      }
    } catch (_) {}
  }, 250);

  setInterval(() => {
    try {
      const m = mnt();
      if (!m) return;
      const d = mountDay();
      if (m._dd == null) m._dd = d;
      if (d > m._dd) {
        m.dirt = Math.min(100, (m.dirt || 0) + 6 * (d - m._dd));
        m._dd = d;
      }
    } catch (_) {}
  }, 2000);
}
