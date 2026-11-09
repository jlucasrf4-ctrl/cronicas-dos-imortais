/* ==== v8.3 — placa do herói no campo: nome, vida e mana acima da cabeça ====
   Pedido do mantenedor (2026-11-09): nome, Vida e Mana sempre visíveis sobre o personagem, estilo MMO. A mana usa a
   cor da afinidade do herói (AFFINITIES[aff].color), não o azul padrão. Desenhada no canvas 2D do campo
   (TELAS.dCtx), chamada por d3Hero (3D) e pelo desenho plano em chao.ts. Medidas na tabela PLACA. */
import { dungeon } from "../core/state.ts";
import { AFFINITIES } from "../data/nascimento.ts";
import type { Hero } from "../core/tipos.ts";

const PLACA = {
  larg: 46, // largura das barras (px do campo)
  vida: 4, // altura da barra de vida
  mana: 2.5, // altura da barra de mana
  vao: 1, // espaço entre as barras
  nome: 10, // tamanho da fonte do nome
};

function barra(c: CanvasRenderingContext2D, x: number, y: number, w: number, hgt: number, frac: number, cor: string) {
  c.fillStyle = "rgba(10,8,6,.78)";
  c.fillRect(x - 1, y - 1, w + 2, hgt + 2);
  c.fillStyle = cor;
  c.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), hgt);
}

/** Desenha nome + vida + mana; `y` é a base da placa (logo acima da cabeça). */
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
    corMana = aff ? aff.color : "#9fe3ff",
    corVida = vida < 0.3 ? "#ff4a4a" : "#5fd35a";
  c.save();
  barra(c, x0, yVida, w, P.vida, vida, corVida);
  barra(c, x0, yMana, w, P.mana, mana, corMana);
  c.font = P.nome + "px Lora, serif";
  c.textAlign = "center";
  const yNome = yVida - 4;
  c.fillStyle = "#1c140b";
  c.fillText(h.name, x + 0.6, yNome + 0.6);
  c.fillStyle = "#fff8e3";
  c.fillText(h.name, x, yNome);
  c.restore();
}
