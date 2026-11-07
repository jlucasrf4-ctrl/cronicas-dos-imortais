/* ==== v7.7 — grade A2: formas sem dentes na mochila ====
   formaA2 (o retângulo do contorno, com os lados grandes 1 casinha menores; tabela GRADE_A2 em data/itens.ts),
   aplicarFormasA2 (na carga: troca as formas de ITEM_DEFS; as runas criadas em jogo passam por runeDef e a carne
   por meatShape) e migrarFormasA2 (saves antigos: cada item ganha a forma nova e a grade se rearruma; o que não
   couber vai para o baú). O visual (fundo uniforme, moldura que segue o contorno, grade de pontinhos) é do
   renderInvGrid (field/chao.ts) e do CSS 46_v7.7_grade_a2.css. */
import { GRADE_A2, ITEM_DEFS } from "../data/itens.ts";
import { econ, world } from "../core/state.ts";
import { canPlace, lugarMaisPerto, rotShape, shapeCells } from "./inventario.ts";
import { placeIn } from "./equipamento.ts";
import { tierShape } from "./qualidade.ts";
import { meatShape } from "../map/caca.ts";
import type { InvGrid, Item } from "../core/tipos.ts";

const deTexto = (art: string[]) => art.map((r) => Array.from(r, (ch) => (ch === "#" ? 1 : 0)));

/** A forma A2 de `sh`: igual se já é retângulo; senão o retângulo do contorno, com os lados de `encolheDe` casinhas
    ou mais 1 menores (`encolher` = false só tira os dentes: a carne, que já é pequena). */
export function formaA2(key: string, sh: number[][], encolher = true): number[][] {
  if (GRADE_A2.manter.includes(key)) return sh.map((r) => r.slice());
  const esp = GRADE_A2.especial[key];
  if (esp) return deTexto(esp);
  let r0 = 99,
    r1 = -1,
    c0 = 99,
    c1 = -1,
    vazias = 0;
  sh.forEach((row, r) =>
    row.forEach((v, c) => {
      if (!v) return;
      r0 = Math.min(r0, r);
      r1 = Math.max(r1, r);
      c0 = Math.min(c0, c);
      c1 = Math.max(c1, c);
    }),
  );
  if (r1 < 0) return sh.map((r) => r.slice());
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (!sh[r][c]) vazias++;
  let H = r1 - r0 + 1,
    W = c1 - c0 + 1;
  if (vazias && encolher) {
    if (H >= GRADE_A2.encolheDe) H--;
    if (W >= GRADE_A2.encolheDe) W--;
  }
  return Array.from({ length: H }, () => new Array(W).fill(1));
}

/** Na carga (depois de todos os módulos que desenham formas): as formas de ITEM_DEFS viram A2. */
export function aplicarFormasA2() {
  for (const k in ITEM_DEFS) {
    const d = ITEM_DEFS[k];
    if (d.shape) d.shape = formaA2(k, d.shape);
  }
}

function mesmaForma(a: number[][], b: number[][]) {
  for (let i = 0; i < 4; i++) {
    if (
      a.length === b.length &&
      a[0].length === b[0].length &&
      a.every((row, r) => row.every((v, c) => !v === !b[r][c]))
    )
      return true;
    b = rotShape(b);
  }
  return false;
}
/** A forma que o item deveria ter hoje (null = deixa como está). */
function formaNova(it: Item): number[][] | null {
  const k = it.def && it.def.key;
  if (!k || GRADE_A2.manter.includes(k) || !it.shape || !it.shape[0]) return null;
  if (k === "carne") return meatShape(it.an || "lobo", it.tier);
  if (!ITEM_DEFS[k] || !ITEM_DEFS[k].shape) return null;
  return tierShape(k, it.tier);
}
/** Grades e itens soltos (equipados, presos no cinto) alcançáveis a partir do econ e dos heróis. */
function coletar(o: unknown, grades: Set<InvGrid>, itens: Set<Item>, vistos: Set<object>, prof: number) {
  if (!o || typeof o !== "object" || vistos.has(o) || prof > 8) return;
  vistos.add(o);
  if (Array.isArray(o)) {
    for (const v of o) coletar(v, grades, itens, vistos, prof + 1);
    return;
  }
  const r = o as Record<string, unknown>;
  if (Array.isArray(r.items) && typeof r.cols === "number") grades.add(o as InvGrid);
  else if (r.def && typeof (r.def as { key?: unknown }).key === "string" && Array.isArray(r.shape))
    itens.add(o as Item);
  for (const k in r) if (k !== "def" && k !== "hero") coletar(r[k], grades, itens, vistos, prof + 1);
}

/** Saves de antes da grade A2: cada item ganha a forma nova; a grade se rearruma (fica onde estava se couber, senão o
    lugar livre mais perto); o que não couber vai para o baú. Devolve quantos itens foram para o baú. */
export function migrarFormasA2() {
  const grades = new Set<InvGrid>(),
    itens = new Set<Item>();
  coletar(econ, grades, itens, new Set(), 0);
  coletar(world.heroes, grades, itens, new Set(), 0);
  for (const it of itens) {
    const k = it.def.key; // saves guardam cópia do def: a forma dela também
    if (ITEM_DEFS[k] && ITEM_DEFS[k].shape && it.def !== ITEM_DEFS[k])
      it.def.shape = ITEM_DEFS[k].shape!.map((r) => r.slice());
  }
  const nasGrades = new Set<Item>();
  let aoBau = 0;
  const sobra: Item[] = [];
  for (const g of grades) {
    const mudam: { it: Item; sh: number[][] }[] = [];
    for (const it of g.items) {
      nasGrades.add(it);
      const sh = formaNova(it);
      if (sh && !mesmaForma(it.shape, sh)) mudam.push({ it, sh });
    }
    if (!mudam.length) continue;
    for (const m of mudam) g.items.splice(g.items.indexOf(m.it), 1);
    mudam.sort((a, b) => shapeCells(b.sh) - shapeCells(a.sh));
    for (const m of mudam) {
      const it = m.it,
        deitado = it.shape[0].length > it.shape.length;
      let sh = m.sh;
      if (sh.length !== sh[0].length && sh[0].length > sh.length !== deitado) sh = rotShape(sh); // mantém o giro
      if (canPlace(g, sh, it.x, it.y, it)) {
        it.shape = sh;
        g.items.push(it);
        continue;
      }
      const p = lugarMaisPerto(g, sh, it.x, it.y, it);
      it.shape = sh;
      if (p) {
        it.x = p.x;
        it.y = p.y;
        it.shape = p.shape;
        g.items.push(it);
      } else sobra.push(it);
    }
  }
  for (const it of sobra) {
    if (!placeIn(econ.stash, it)) econ.stash.items.push(it);
    aoBau++;
  }
  for (const it of itens) {
    if (nasGrades.has(it)) continue;
    const sh = formaNova(it); // equipado: só a forma (volta para a grade quando sair do corpo)
    if (sh && !mesmaForma(it.shape, sh)) it.shape = sh;
  }
  return aoBau;
}
