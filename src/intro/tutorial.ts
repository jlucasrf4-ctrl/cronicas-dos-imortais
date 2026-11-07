/* ==== Fase 4 — tutorial do acampamento com o Caçador (v6.4) ==== */
import { GL3, dungeon, econ, CACA, TELAS } from "../core/state.ts";
import { MB, mbBox, mbCyl, glMesh, mbIco } from "../render/gl/malhas.ts";
import { M4 } from "../render/gl/geometria.ts";
import { glPush } from "../render/gl/renderer.ts";
import { cacadorAnimado, cacadorCentro } from "../render/gl/cacador_anim.ts";
import { hunterParts, introUi, introObj, say, ISC } from "./cena.ts";
import type { PaginaFala } from "./cena.ts";
import { CPS, ACAMP_PROPS } from "../survival/acampamento.ts";
import { mbCenario } from "../render/gl/cenario.ts";
import { MOB } from "../ui/celular.ts";
import { spawnDungeonToast } from "../field/masmorra.ts";
import { mvToast } from "../ui/avisos.ts";
import { sfx, tryAddToInv, toggleInv } from "../field/chao.ts";
import { ensureInv } from "../items/inventario.ts";
import { qvInv } from "../expedicao/preparo.ts";
import { invCount, fireEnsureDom, FIRE, fireRender, fireClose } from "../field/fogueira.ts";
import { campanhaEvento, chamadoAtual, falar } from "../campanha/campanha.ts";
import { cercadoGL } from "../campanha/cercado.ts";
import type { Ponto } from "../core/tipos.ts";

/* ---------- ACAMPAMENTO: chegada com o Caçador (fogueira → carne SS → jantar → barraca → cochilo) ---------- */
export const CT = { on: false, unlit: false, lighting: false, stage: "", choice: null as null };
/* barraca e Caçador dormindo */
function tentMesh() {
  if (GL3.mesh.tent) return GL3.mesh.tent;
  const o = MB();
  // v8.0: a barraca em A dos props de acampamento (tools/modelos/cenario.json); sem os dados, a feita por código
  if (mbCenario(o, "barraca", 0, 0, ACAMP_PROPS.barraca, { giro: ACAMP_PROPS.giroBarraca }))
    return (GL3.mesh.tent = glMesh(o));
  const cl = "#b39a6a",
    cd = "#8c7650",
    wd = "#6a4a2a";
  mbBox(o, M4.ch(M4.T(-10.2, 11, 0), M4.RZ(-0.75), M4.S(1.4, 30, 30)), cl, 1, 0.04);
  mbBox(o, M4.ch(M4.T(10.2, 11, 0), M4.RZ(0.75), M4.S(1.4, 30, 30)), cd, 1, 0.04);
  mbCyl(o, M4.ch(M4.T(0, 22, -16), M4.RX(Math.PI / 2), M4.S(1, 32, 1)), "#5a3e22", 6, 1);
  mbBox(o, M4.ch(M4.T(0, 0.5, 0), M4.S(34, 1, 34)), "#5b4a33", 1, 0.08);
  for (const z of [-15.5, 15.5]) mbCyl(o, M4.ch(M4.T(0, 0, z), M4.S(1.2, 23, 1.2)), wd, 6, 1);
  mbBox(o, M4.ch(M4.T(0, 7, 15.5), M4.S(8, 14, 0.6)), "#3a2c1c", 1, 0.02);
  return (GL3.mesh.tent = glMesh(o));
}
function napGL(n: Ponto) {
  /* v7.7 — Caçador animado deitado de costas no colchonete (a pose final da queda), centrado nele */
  const an = cacadorAnimado(n.x, n.y, { deitado: true });
  if (an) {
    const [cx, cz] = cacadorCentro(an.mat);
    glPush(an.mesh, M4.ch(M4.T(n.x, 1.5, n.y), M4.RY(-0.4 + Math.PI / 2), M4.S(1.3), M4.T(-cx, 0, -cz)));
  } else {
    const P = hunterParts(),
      B = M4.ch(M4.T(n.x, 5, n.y), M4.RY(-0.4), M4.RZ(-Math.PI / 2), M4.S(1.3)),
      br = Math.sin(performance.now() / 700) * 0.4;
    glPush(P.torso, M4.ch(B, M4.T(br * 0.3, 0, 0)));
    glPush(P.leg, M4.ch(B, M4.T(0, 15, 2.8)));
    glPush(P.leg, M4.ch(B, M4.T(0, 15, -2.8)));
    glPush(P.armPlain, M4.ch(B, M4.T(0, 28, 7.6), M4.RZ(0.25)));
    glPush(P.armPlain, M4.ch(B, M4.T(0, 28, -7.6), M4.RZ(0.15)));
  }
  if (!GL3.mesh.bedroll) {
    const b = MB();
    mbBox(b, M4.S(16, 2, 44), "#6b3f2a", 1, 0.08);
    GL3.mesh.bedroll = glMesh(b);
  }
  glPush(GL3.mesh.bedroll, M4.ch(M4.T(n.x, 1, n.y), M4.RY(-0.4 + Math.PI / 2)));
}
/* barraca, Caçador dormindo e brasas apagadas (armasGLPush chama; sl/keep = Caçador cochilando) */
export function campNapGL(sl: unknown, keep: Ponto | null | undefined) {
  const d = dungeon;
  if (!d.camp) return;
  if (econ.tent && CPS.tent) glPush(tentMesh(), M4.ch(M4.T(CPS.tent.x, 0, CPS.tent.y), M4.RY(0.5)));
  cercadoGL(); // v7.7 — campanha: o cercado dos lobos
  if (sl && keep) napGL(keep);
  if (CT.unlit && CPS.fire) {
    if (!GL3.mesh.ember) {
      const b = MB();
      mbIco(b, M4.S(1), "#3a2a1c", 0, 0.3, 0.05);
      GL3.mesh.ember = glMesh(b);
    }
    for (let i = 0; i < 4; i++)
      glPush(
        GL3.mesh.ember,
        M4.ch(
          M4.T(CPS.fire.x + Math.cos(i * 1.6) * 4, 1.5, CPS.fire.y + Math.sin(i * 1.6) * 4),
          M4.RY(i),
          M4.S(5, 2, 2),
        ),
        null,
      );
  }
}

export function ctObj(t: string, s: string) {
  try {
    introUi();
    document.getElementById("isc-cine")!.classList.remove("on");
    introObj(t, s);
  } catch (_) {}
}
function ctSay(pages: PaginaFala[], done: () => void) {
  try {
    introUi();
    document.getElementById("isc-cine")!.classList.remove("on");
  } catch (_) {}
  say(pages, done);
}
/* v7.7 — campanha: as falas do Caçador aqui saem da tabela FALAS (data/campanha.ts) */
function ctFalar(id: string, done: () => void, acoes?: Record<number, () => void>) {
  try {
    introUi();
    document.getElementById("isc-cine")!.classList.remove("on");
  } catch (_) {}
  falar(id, done, acoes);
}
export function ctArrive() {
  if (!dungeon.active || !dungeon.camp) return;
  campanhaEvento("acampamentoChegou");
  ctFalar("cacador_chegada", () => {
    CT.stage = "fire";
    ctObj("🔥 Acenda a fogueira", (MOB.on ? "toque em ✋" : "E") + " perto da fogueira apagada");
  });
}
export function ctTent() {
  if (!dungeon.active || !dungeon.camp) {
    CT.stage = "";
    return;
  }
  ctFalar(
    "cacador_barraca",
    () => {
      econ.hunterNap = true;
      econ.campTut = 3;
      campanhaEvento("acampamentoFim");
      CT.on = false;
      CT.stage = "";
      ctObj("💤 O Caçador está cochilando", "fique à vontade — mas sem martelar");
      setTimeout(() => ctObj("", ""), 6000);
    },
    {
      1: () => {
        econ.tent = true;
        spawnDungeonToast(
          "⛺ Barraca montada",
          CPS.tent ? CPS.tent.x : dungeon.px,
          (CPS.tent ? CPS.tent.y : dungeon.py) - 40,
          "#ffe08a",
          14,
        );
        sfx("perfect");
      },
    },
  );
}
export function ctFireOpen() {
  const d = dungeon,
    h = d.hero!;
  if (invCount(h, "pedra") < 2)
    for (let i = invCount(h, "pedra"); i < 2; i++) tryAddToInv(ensureInv(h), "pedra") || tryAddToInv(qvInv(h), "pedra");
  if (invCount(h, "galho") < 3)
    for (let i = invCount(h, "galho"); i < 3; i++) tryAddToInv(ensureInv(h), "galho") || tryAddToInv(qvInv(h), "galho");
  fireEnsureDom();
  FIRE.open = true;
  FIRE.mg = null;
  d.modalOpen = true;
  d.charging = false;
  d.guard = false;
  CT.lighting = true;
  document.getElementById("fire-modal")!.classList.add("open");
  fireRender();
}
export function ctMeat() {
  ctSay(
    [
      ["Isso! Agora sim."],
      {
        0: "Aquele javali que você encontrou tinha uma carne muito boa.",
        1: "Já viu carne assim?",
        act: () => {
          const h = dungeon.hero!;
          CACA.MEAT_SRC = "javali";
          if (!tryAddToInv(ensureInv(h), "carne", 2)) tryAddToInv(qvInv(h), "carne", 2);
          spawnDungeonToast("+ Carne de Javali SS", dungeon.px, dungeon.py - 48, "#ffd24a", 14);
        },
      },
    ],
    () => {
      CT.stage = "inv";
      try {
        toggleInv(true);
      } catch (_) {}
      setTimeout(() => {
        if (dungeon.active && dungeon.camp) ctAskCook();
      }, 1400);
    },
  );
} // v6.5: pergunta de cozinhar depois de um tempo, sem esperar fechar a mochila
/** Escolha com botões (o tutorial; v7.7: também a campanha, com outro `quem` no topo). */
function ctChoice(q: string, opts: [string, () => void][], quem = "🏹 Caçador") {
  opts = opts.map((o) => [
    o[0],
    () => {
      try {
        if (dungeon.invOpen) toggleInv(false);
      } catch (_) {}
      o[1]();
    },
  ]); // v6.5 — escolher fecha a mochila antes
  introUi();
  const v = document.getElementById("dungeon-view")!;
  let m = document.getElementById("isc-choice");
  if (!m) {
    m = document.createElement("div");
    m.id = "isc-choice";
    v.appendChild(m);
  }
  m.innerHTML =
    "<div class='ich-who'>" +
    quem +
    "</div><div class='ich-q'>" +
    q +
    "</div><div class='ich-b'>" +
    opts.map((o, i: number) => "<button class='btn pri' data-ch='" + i + "'>" + o[0] + "</button>").join("") +
    "</div>";
  m.classList.add("on");
  dungeon.modalOpen = true;
  m.onclick = (e) => {
    const b = (e.target as HTMLElement).closest("[data-ch]") as HTMLElement;
    if (!b) return;
    e.stopPropagation();
    m.classList.remove("on");
    dungeon.modalOpen = false;
    opts[+b.dataset.ch!][1]();
  };
}
function ctAskCook() {
  ctChoice("Já teve a chance de cozinhar carne assim?", [
    [
      "Sim",
      () =>
        ctSay(
          [
            ["Então vou confiar nas suas mãos para fazer o nosso jantar."],
            ["Vejo que ainda está acabado depois da luta.", "A comida vai te ajudar a levantar o espírito."],
          ],
          ctCook,
        ),
    ],
    [
      "Não",
      () =>
        ctSay(
          [
            ["Então deixo em suas mãos uma carne dessas.", "Com o tempo certo no fogo, já fica perfeita."],
            ["Vejo que ainda está acabado depois da luta.", "A comida vai te ajudar a levantar o espírito."],
          ],
          ctCook,
        ),
    ],
  ]);
}
function ctCook() {
  CT.stage = "cook";
  ctObj("🍖 Asse a carne na fogueira", (MOB.on ? "toque em ✋" : "E") + " perto do fogo · vire na hora certa");
}
/* 💤 do Caçador cochilando (armasDraw2D chama); v7.7: ❗ quando ele chama (campanha, missão com `chamado`) */
export function napDraw2D() {
  const d = dungeon,
    c = TELAS.dCtx;
  if (!d.camp || !CPS.hunter) return;
  const t = performance.now() / 1000;
  if (chamadoAtual() && !CT.on) {
    if (ISC.dlg) return; // falando: sem o ❗
    c.save();
    c.font = "900 22px Cinzel,serif";
    c.textAlign = "center";
    c.lineWidth = 4;
    c.strokeStyle = "rgba(20,12,4,.85)";
    c.fillStyle = "#ffd24a";
    const y = CPS.hunter.y - 46 + Math.sin(t * 3) * 3;
    c.strokeText("!", CPS.hunter.x, y);
    c.fillText("!", CPS.hunter.x, y);
    c.restore();
    return;
  }
  if (!econ.hunterNap) return;
  c.save();
  c.font = "600 12px Lora,serif";
  c.fillStyle = "rgba(220,235,255," + (0.5 + 0.4 * Math.sin(t * 2)) + ")";
  c.textAlign = "center";
  c.fillText("💤", CPS.hunter.x + 8 + Math.sin(t) * 3, CPS.hunter.y - 30 - ((t * 6) % 10));
  c.restore();
}

/* v7.7 — pular o tutorial do acampamento (o botão "Pular" da fala, que antes só servia na introdução e aqui não fazia
   nada): fecha a fala, a fogueira e a escolha abertas e deixa tudo como no fim dele (barraca montada, Caçador cochilando,
   a missão do acampamento concluída) */
export function ctAtivo() {
  return !!dungeon.active && !!dungeon.camp && econ.campTut === 2;
}
export function ctPular() {
  if (!ctAtivo()) return;
  const d = dungeon;
  ISC.dlg = null;
  document.getElementById("isc-dlg")?.classList.remove("on");
  document.getElementById("isc-choice")?.remove();
  if (FIRE.open) fireClose();
  if (d.invOpen) toggleInv(false);
  d.modalOpen = false;
  CT.lighting = false;
  CT.unlit = false;
  CT.on = false;
  CT.stage = "";
  econ.fireLv = Math.max(1, econ.fireLv! | 0);
  econ.tent = true;
  econ.hunterNap = true;
  econ.campTut = 3;
  campanhaEvento("acampamentoFim");
  ctObj("", "");
  mvToast("⏭ Tutorial do acampamento pulado");
}
