/* ==== v8.3 — placa do herói no campo: nome, vida e mana acima da cabeça ====
   Pedido do mantenedor (2026-11-09): nome, Vida e Mana sempre visíveis sobre o personagem, estilo MMO (referência:
   nome forte, linha de afinidade embaixo, vida em gomos, mana fina). A mana usa a cor da afinidade do herói
   (AFFINITIES[aff].color/ink), não o azul padrão. Desenhada no canvas 2D do campo (TELAS.dCtx), chamada por d3Hero
   (3D) e pelo desenho plano em chao.ts. Medidas e cores na tabela PLACA. */
import { dungeon } from "../core/state.ts";
import { AFFINITIES } from "../data/nascimento.ts";
import type { Hero } from "../core/tipos.ts";

const PLACA = {
  larg: 50, // largura das barras (px do campo)
  vida: 5, // altura da barra de vida
  mana: 2.5, // altura da barra de mana
  vao: 1.5, // espaço entre as barras
  gomos: 5, // divisões da barra de vida
  nome: 10.5, // fonte do nome
  sub: 6.5, // fonte da linha de afinidade/nível
  moldura: "rgba(255,214,140,.55)",
  fundo: "rgba(12,9,6,.82)",
  vidaCor: ["#d9f27a", "#7bd03c", "#3f8f22"], // topo, meio, base
  vidaBaixa: ["#ffb08a", "#e8452a", "#8a1608"],
};

function barra(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  frac: number,
  cores: string[],
  gomos: number,
) {
  const P = PLACA,
    f = Math.max(0, Math.min(1, frac));
  // moldura dourada fina + fundo escuro
  c.fillStyle = P.moldura;
  c.fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
  c.fillStyle = P.fundo;
  c.fillRect(x - 0.5, y - 0.5, w + 1, h + 1);
  if (f > 0) {
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, cores[0]);
    g.addColorStop(0.45, cores[1]);
    g.addColorStop(1, cores[2]);
    c.fillStyle = g;
    c.fillRect(x, y, w * f, h);
    // brilho de vidro na metade de cima
    c.fillStyle = "rgba(255,255,255,.28)";
    c.fillRect(x, y, w * f, Math.max(0.6, h * 0.35));
  }
  // gomos
  if (gomos > 1) {
    c.fillStyle = "rgba(12,9,6,.85)";
    for (let i = 1; i < gomos; i++) c.fillRect(Math.round(x + (w * i) / gomos) - 0.4, y, 0.8, h);
  }
}

function texto(c: CanvasRenderingContext2D, t: string, x: number, y: number, cor: string, contorno: number) {
  c.lineJoin = "round";
  c.lineWidth = contorno;
  c.strokeStyle = "rgba(10,7,4,.92)";
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
  barra(c, x0, yVida, w, P.vida, vida, vida < 0.3 ? P.vidaBaixa : P.vidaCor, P.gomos);
  barra(c, x0, yMana, w, P.mana, mana, ["#ffffff", cor, tinta], 1);
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
