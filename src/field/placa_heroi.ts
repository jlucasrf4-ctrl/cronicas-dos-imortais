/* ==== v8.3 — placa do herói no campo: nome, vida e mana acima da cabeça ====
   Pedido do mantenedor (2026-11-09): nome, Vida e Mana sempre visíveis sobre o personagem, estilo MMO (nome forte,
   linha de afinidade embaixo). Barras arredondadas com borda discreta na paleta do HUD (bronze sobre carvão) e
   enchimento com aspecto de líquido: a ponta ondula, um brilho atravessa devagar, reflexo de vidro em cima e bolhas
   na vida. A mana usa a cor da afinidade do herói (AFFINITIES[aff].color/ink). Desenhada no canvas 2D do campo
   (TELAS.dCtx), chamada por d3Hero (3D) e pelo desenho plano em chao.ts. Medidas e cores na tabela PLACA. */
import { dungeon } from "../core/state.ts";
import { AFFINITIES } from "../data/nascimento.ts";
import type { Hero } from "../core/tipos.ts";

const PLACA = {
  larg: 50, // largura das barras (px do campo)
  vida: 5, // altura da barra de vida
  mana: 3, // altura da barra de mana
  vao: 1.5, // espaço entre as barras
  nome: 10.5, // fonte do nome
  sub: 6.5, // fonte da linha de afinidade/nível
  borda: "rgba(169,121,63,.55)", // o bronze das bordas do HUD
  fundo: "rgba(22,19,16,.85)", // o carvão do HUD
  vidaCor: ["#b8f27a", "#4fbf38", "#1f6a14"], // superfície, meio, fundo
  vidaBaixa: ["#ffb08a", "#e0402a", "#6a0f06"],
  onda: 0.7, // amplitude da ondulação na ponta (px)
  brilho: 2.6, // segundos para o brilho atravessar a barra
};

/** Uma barra em pílula com enchimento líquido. `fase` desencontra as ondas entre barras. */
function barraLiquida(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  frac: number,
  cores: string[],
  fase: number,
  bolhas: boolean,
) {
  const P = PLACA,
    f = Math.max(0, Math.min(1, frac)),
    r = h / 2 + 1,
    t = performance.now() / 1000 + fase;
  // borda discreta + fundo
  c.beginPath();
  c.roundRect(x - 1, y - 1, w + 2, h + 2, r);
  c.fillStyle = P.fundo;
  c.fill();
  c.lineWidth = 0.7;
  c.strokeStyle = P.borda;
  c.stroke();
  if (f <= 0) return;
  c.save();
  c.beginPath();
  c.roundRect(x, y, w, h, h / 2);
  c.clip();
  // o líquido: ponta direita ondulando
  const ex = x + w * f,
    passos = 6;
  c.beginPath();
  c.moveTo(x, y);
  for (let i = 0; i <= passos; i++) {
    const yy = y + (h * i) / passos;
    c.lineTo(f >= 1 ? ex + 1 : ex + Math.sin(t * 5 + i * 1.3) * P.onda, yy);
  }
  c.lineTo(x, y + h);
  c.closePath();
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, cores[0]);
  g.addColorStop(0.4, cores[1]);
  g.addColorStop(1, cores[2]);
  c.fillStyle = g;
  c.fill();
  c.clip();
  // brilho atravessando devagar
  const bx = x - 12 + (((t / P.brilho) % 1) + 1) % 1 * (w + 24),
    gb = c.createLinearGradient(bx - 8, 0, bx + 8, 0);
  gb.addColorStop(0, "rgba(255,255,255,0)");
  gb.addColorStop(0.5, "rgba(255,255,255,.35)");
  gb.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = gb;
  c.fillRect(bx - 8, y, 16, h);
  // bolhas subindo na vida
  if (bolhas && h >= 4) {
    c.fillStyle = "rgba(255,255,255,.45)";
    for (let i = 0; i < 3; i++) {
      const bxx = x + ((i * 0.37 + 0.13) % 1) * w * f,
        sobe = (t * (0.6 + i * 0.25) + i * 0.4) % 1;
      c.beginPath();
      c.arc(bxx + Math.sin(t * 3 + i) * 0.4, y + h - 0.6 - sobe * (h - 1.2), 0.45, 0, Math.PI * 2);
      c.fill();
    }
  }
  // reflexo de vidro em cima, fininho
  c.fillStyle = "rgba(255,255,255,.3)";
  c.fillRect(x, y + 0.5, w, Math.max(0.6, h * 0.22));
  c.restore();
}

function texto(c: CanvasRenderingContext2D, t: string, x: number, y: number, cor: string, contorno: number) {
  c.lineJoin = "round";
  c.lineWidth = contorno;
  c.strokeStyle = "rgba(10,7,4,.9)";
  c.strokeText(t, x, y);
  c.fillStyle = cor;
  c.fillText(t, x, y);
}

/** Desenha nome + afinidade/nível + vida + mana; `y` é a base da placa (logo acima da cabeça). */
export function desenharPlacaHeroi(c: CanvasRenderingContext2D, h: Hero, x: number, y: number) {
  const d = dungeon,
    P = PLACA,
    w = P.larg,
    x0 = Math.round(x - w / 2),
    yMana = Math.round(y - P.mana),
    yVida = yMana - P.vao - P.vida,
    vida = d.hpMax > 0 ? d.hp / d.hpMax : 0,
    mana = h.manaMax ? (h.mana || 0) / h.manaMax : 0,
    aff = AFFINITIES[h.aff],
    cor = aff ? aff.color : "#9fe3ff",
    tinta = aff ? aff.ink : "#3a7fa0";
  c.save();
  barraLiquida(c, x0, yVida, w, P.vida, vida, vida < 0.3 ? P.vidaBaixa : P.vidaCor, 0, true);
  barraLiquida(c, x0, yMana, w, P.mana, mana, ["#ffffff", cor, tinta], 1.7, false);
  c.textAlign = "center";
  c.textBaseline = "alphabetic";
  // linha de afinidade e nível, na cor do elemento
  const ySub = yVida - 3.5;
  c.font = "700 " + P.sub + "px Lora, serif";
  texto(c, "[" + (aff ? aff.name.split("/").pop()!.toUpperCase() : "?") + "] Nv." + (h.lvl || 1), x, ySub, cor, 2);
  // nome
  c.font = "700 " + P.nome + "px Lora, serif";
  texto(c, h.name, x, ySub - P.sub - 1.5, "#fff8e3", 2.6);
  c.restore();
}
