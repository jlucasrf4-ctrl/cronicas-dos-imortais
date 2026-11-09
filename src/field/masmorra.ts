/* ==== Fase 4 ====
   o campo (masmorra): canvas, entrada e saída, área segura, revelar, chão (base/04, base/15, v5.8) */
import { abrirBauCampo } from "../ui/recipientes.ts";
import { centroCorpo } from "./acertos.ts";
import { ehBolsa, vestirBolsa } from "../items/mochilas.ts";
import { GROUND_DEFS, INTERACT_R, EXP_WAVES } from "../data/expedicao.ts";
import { ITEM_DEFS } from "../data/itens.ts";
import { nv, nodeRank } from "../hero/arvores.ts";
import { dungeon, TELAS, GL3, econ, OPT, CACA } from "../core/state.ts";
import { HERO } from "./combate.ts";
import { CZ, finPrompt, folOn, folAnel, folAnelVisivel, folAnelRaio } from "./tipos.ts";
import { D3, d3Follow, d3Bill } from "./projecao.ts";
import { MOB } from "../ui/celular.ts";
import { gfxDpr } from "../ui/opcoes.ts";
import { glInit, glPlace } from "../render/gl/renderer.ts";
import { mvToast, toastIcon, hintShowOnce } from "../ui/avisos.ts";
import { prep, updateEcon } from "../econ/economia.ts";
import { CRIT, campoPovoar, groundAt, critSpawn } from "./campo_vida.ts";
import { TXT, CAMPO_CHAO, CHAO_KINDS, CAMPO_VIDA, CRIT_SP } from "../data/campo.ts";
import { INVF, setNo, swapSet } from "../ui/inventario.ts";
import {
  toggleInv,
  renderInv,
  buildGroundInv,
  groundPut,
  addRing,
  sfx,
  shakeScreen,
  tryAddItem,
  bankLoot,
  xpBurst,
  addBowPts,
} from "./chao.ts";
import { WEAPONS, POUNCE_LOCK, LOBO_NIVEL } from "../data/combate.ts";
import { ehNoite } from "../campanha/sono.ts";
import { wpnKey, spearStuckNear, spearPull, spearGroundNear, armasExitCheck } from "./armas.ts";
import { isLanca } from "../items/galho.ts";
import { ensureEquip, unequip, mkItem, placeIn } from "../items/equipamento.ts";
import { eqName } from "../items/durabilidade.ts";
import { EQ_SLOTS, ORE_TABLE } from "../data/equipamento.ts";
import { icoItemQ, eLootFirst, icoCanvas, lootVis, icoDraw, icoLootDef } from "../ui/icones.ts";
import { canPlace, rotShape, ensureInv, TIERS } from "../items/inventario.ts";
import { BANNER_SUBS } from "../data/icones.ts";
import { JOGO } from "../ui/modos.ts";
import { mundoEntrar, mundoTick, pontoPerto, vistaCampo, bichoNovo, bichosSoltar } from "../map/mundo.ts";
import { caminhadaTick } from "../intro/caminhada.ts";
import { acampamentoCampoTick } from "./acampamento_campo.ts";
import { perigoCampoTick } from "../map/perigo.ts";
import { rastroTick } from "./rastro.ts";
import { moitaSpawn, inMoita } from "./moitas.ts";
import { pushEvent } from "../sim/eventos.ts";
import { forgeBossDrop } from "../forja/forja.ts";
import { addHeroXp, gainSkill, ensureHero } from "../hero/nivel.ts";
import { TR, trainWolf, trainHuman, TR_SIZE, DG_SIZE, trainSetup, trainHud, manequimPerto } from "./treino.ts";
import { vestir } from "../render/gl/vestidos.ts";
import { runeSeedDungeon, runeNearDungeon } from "../runas/runas.ts";
import { CPS, campSetup, campNear, CAMP, campOpen, campForge } from "../survival/acampamento.ts";
import { VCS, vilaSetup, vilaPerto, vilaAbrir } from "../map/vila_cena.ts";
import { VILA_CENA } from "../data/vila.ts";
import { mnt, mountNear, mountPanel } from "../creatures/tamandua.ts";
import { ISC, introSetup, campTalk } from "../intro/cena.ts";
import { hpMaxOf, attrOf } from "../hero/atributos.ts";
import { hpCap } from "../survival/sobrevivencia.ts";
import type { AveCampo, GradeTela, Hero, Item, ItemDef, LootChao, Monster, Repasse } from "../core/tipos.ts";
import type { ItemChao } from "../data/expedicao.ts";
import { spawnJavalino } from "../creatures/javali.ts";
import { lootName } from "../items/qualidade.ts";
import { resAdd, tryAddQuiver, qvInv, exitDungeon, openPrep, arrowCap } from "../expedicao/preparo.ts";
import { CT, ctFireOpen } from "../intro/tutorial.ts";
import { atenderChamado } from "../campanha/campanha.ts";
import { interagirCercado } from "../campanha/cercado.ts";
import { HUNTER_TIPS } from "../data/intro.ts";
import { cacadaNoCampo, cacadaTick, cacadaAbatida } from "../map/cacada.ts";
import { finishTarget, finishStart } from "./faca_corda.ts";
import { carpOpen } from "../forja/carpintaria.ts";
import { anaOpen } from "../forja/analise.ts";
import { dfireNear } from "./fogueira.ts";
import { runeAbsorbOpen } from "../runas/absorcao.ts";
import { birdFly } from "../render/gl/animais.ts";
import { heroinaColetar } from "../render/gl/heroina_anim.ts";
import { desenharAcoes } from "../ui/acoes.ts";
import { clamp } from "../core/util.ts";
import { drawSprite } from "../render/sprites.ts";
import { interagirTroncoProximo, limparRegistroRecursosCampo } from "./recursos_campo.ts";

// a definição do saque: do chão (GROUND_DEFS: pode apontar para um item) ou um item (ITEM_DEFS: tem cor)
export function lootInfo(l: LootChao): ItemChao & Partial<ItemDef> {
  return l.ground ? GROUND_DEFS[l.key] : ITEM_DEFS[l.key];
}
export function nearestLoot() {
  let best = null,
    bd = INTERACT_R * nv(HERO()!, "olhar_atento", 1);
  for (const l of dungeon.loot!) {
    const dd = Math.hypot(l.x - dungeon.px, l.y - dungeon.py);
    if (dd < bd) {
      bd = dd;
      best = l;
    }
  }
  return best;
}

export function fitDungeonCanvas() {
  /* v6.9 */
  CZ.f = 1;
  {
    const wrap0 = document.getElementById("dungeon-stage-wrap");
    if (wrap0 && TELAS.dCanvas && D3.on) {
      const { W, H } = vistaCampo(), // v8.0: no campo aberto, a vista (não a janela inteira)
        dpr = gfxDpr(),
        cw = Math.max(200, wrap0.clientWidth - 20),
        ch = Math.max(150, wrap0.clientHeight - 20);
      D3.cw = cw;
      D3.ch = ch;
      D3.dpr = dpr;
      D3.cx = W / 2;
      D3.cz = H / 2;
      D3.s = Math.min(cw / W, ch / (H * D3.SIN! + D3.WALL * D3.COS!)) * 0.98;
      D3.vy = (D3.WALL * D3.COS! * D3.s) / 2;
      TELAS.dCanvas.style.width = cw + "px";
      TELAS.dCanvas.style.height = ch + "px";
      TELAS.dCanvas.width = Math.round(cw * dpr);
      TELAS.dCanvas.height = Math.round(ch * dpr);
      dungeon.k = dpr * D3.s;
      wrap0.classList.add("r3d");
      if (!GL3.tried) glInit();
      D3.gl = GL3.ok;
      wrap0.classList.toggle("rgl", D3.gl);
      if (D3.gl) {
        D3.s *= D3.ZM;
        if (MOB.on) D3.s = Math.max(D3.s, Math.min(cw, ch) / 430);
        D3.vy = 0;
        dungeon.k = dpr * D3.s;
        D3.cx = dungeon.px || W / 2;
        D3.cz = dungeon.py || H / 2;
        d3Follow(1);
        glPlace();
      }
      return;
    }
    D3.gl = false;
    if (wrap0) wrap0.classList.remove("r3d", "rgl");
  }
  const wrap = document.getElementById("dungeon-stage-wrap");
  if (!wrap || !TELAS.dCanvas) return;
  const W = dungeon.cols * dungeon.tile,
    H = dungeon.rows * dungeon.tile,
    dpr = gfxDpr();
  const aw = Math.max(200, wrap.clientWidth - 20),
    ah = Math.max(150, wrap.clientHeight - 20),
    css = Math.max(0.5, Math.min(aw / W, ah / H));
  TELAS.dCanvas.style.width = Math.floor(W * css) + "px";
  TELAS.dCanvas.style.height = Math.floor(H * css) + "px";
  TELAS.dCanvas.width = Math.round(W * css * dpr);
  TELAS.dCanvas.height = Math.round(H * css * dpr);
  dungeon.k = css * dpr;
}
export function inExitZone() {
  return Math.hypot(dungeon.px - dungeon.entrance.x, dungeon.py - dungeon.entrance.y) <= dungeon.tile * 1.4;
}

export function itemMsg(t: string) {
  if (dungeon.active) spawnDungeonToast(t, dungeon.px, dungeon.py - 50, "#ffe08a", 12);
  else if (prep.open) document.getElementById("prep-msg")!.textContent = t;
  else mvToast(t);
}
export function spawnDungeonToast(
  this: unknown,
  text: string,
  _x?: number,
  _y?: number,
  _color?: string,
  _size?: number,
  _font?: string,
) {
  // os outros vão por `arguments` para as etapas
  /* v6.8 */
  if (CRIT.cur && typeof text === "string" && /^Lobo (Alfa )?derrotado/.test(text)) {
    const m = CRIT.cur;
    return spawnDungeonToastBase5.call(this, m.name + " abatido", m.x, m.y - 20, "#ffe08a", 12);
  }
  return spawnDungeonToastBase5.apply(this, arguments as Repasse);
}
// etapa de spawnDungeonToast: v6.3
function spawnDungeonToastBase5(
  this: unknown,
  text: string,
  x: number,
  y: number,
  color: string,
  size: number,
  font?: string,
) {
  /* v6.3 */
  const d = dungeon;
  if (!d.toasts) return spawnDungeonToastBase4.apply(this, arguments as Repasse);
  if (typeof text === "string" && text.length > 2 && d.toasts.some((t) => !t.dmg && t.text === text && t.life > 0.5))
    return;
  const n0 = d.toasts.length;
  const r = spawnDungeonToastBase4.call(
    this,
    text,
    x,
    y,
    color,
    size ? Math.max(9, Math.round(size * TXT.escala)) : size,
    font,
  );
  /* v7.7 — o abate solta vários avisos de uma vez no mesmo ponto: o novo sobe uma linha até não encostar em outro */
  for (const nt of d.toasts.slice(n0)) {
    if (nt.dmg) continue;
    const lh = (nt.size || 12) * 1.6;
    for (let k = 0; k < 6; k++) {
      const bate = d.toasts.some(
        (o) => o !== nt && !o.dmg && o.life > 0.2 && Math.abs(o.x - nt.x) < 90 && Math.abs(o.y - nt.y) < lh,
      );
      if (!bate) break;
      nt.y -= lh;
    }
  }
  const txt = d.toasts.filter((t) => !t.dmg && !t.icon);
  if (txt.length > TXT.maxToasts) {
    const o = txt[0];
    d.toasts.splice(d.toasts.indexOf(o), 1);
  }
  return r;
}
// etapa de spawnDungeonToast: v5.2 + v5.9.02
function spawnDungeonToastBase4(
  this: unknown,
  text: string,
  _x: number,
  _y: number,
  _color: string,
  _size: number,
  _font?: string,
) {
  spawnDungeonToastBase3.apply(this, arguments as Repasse);
  /* v5.9.02 — ---------------- mochila cheia → tela Mochila × Chão ---------------- */
  if (
    dungeon.active &&
    !dungeon.invOpen &&
    !dungeon.modalOpen &&
    (text === "Mochila cheia!" || text === "Mochila e aljava cheias!")
  ) {
    const now = performance.now();
    if (!INVF.t || now - INVF.t > 900) {
      INVF.t = now;
      INVF.full = true;
      setTimeout(() => {
        if (dungeon.active && !dungeon.invOpen) toggleInv(true);
      }, 60);
    }
  }
}
function spawnDungeonToastBase3(
  this: unknown,
  text: string,
  x: number,
  y: number,
  color: string,
  _size: number,
  _font?: string,
) {
  const d = dungeon,
    s = String(text),
    mm = /^-(\d+)$/.exec(s);
  if (!mm) {
    // aviso comum: não repete o mesmo texto no mesmo lugar
    if (
      d.toasts &&
      d.toasts.some(
        (t) => !t.dmg && t._src === s && t.life > 0.55 && Math.abs(t._sx! - x) < 34 && Math.abs(t._sy! - y) < 34,
      )
    )
      return;
    const n0 = d.toasts ? d.toasts.length : 0;
    spawnDungeonToastBase2.apply(this, arguments as Repasse);
    if (d.toasts)
      for (let i = n0; i < d.toasts.length; i++) {
        d.toasts[i]._src = s;
        d.toasts[i]._sx = x;
        d.toasts[i]._sy = y;
      }
    return;
  }
  const v = +mm[1],
    tg = d._dmgTgt || null,
    dot = !!d._dmgDot,
    crit = !!d._dmgCrit,
    now = performance.now();
  const live = tg ? d.toasts.filter((t) => t.dmg && t.tg === tg && t.life > 0.12) : [];
  const m = live.find((t) => (dot ? t.dot : !t.dot && !t.crit && !crit && now - t.t0! < 300));
  if (m) {
    m.val! += v;
    m.text = "-" + m.val;
    m.life = Math.max(m.life, 0.85);
    m.bump = 1;
    if (!dot) m.t0 = now;
    if (m.val! >= 5 && !m.dot) {
      m.color = "#ffe08a";
      m.base = Math.max(m.base!, 14);
    }
    return;
  }
  if (live.length >= 5) live[0].life = Math.min(live[0].life, 0.2);
  const k = Math.min(4, live.filter((t) => t.life > 0.4).length),
    side = (d._dmgSide = -(d._dmgSide || 1));
  const ax = tg ? tg.x : x,
    ay = tg ? tg.y - 20 : y;
  d.toasts.push({
    dmg: true,
    tg,
    dot,
    crit,
    val: v,
    text: "-" + v,
    x: ax + side * (5 + k * 8) + (dot ? 12 : 0),
    y: ay - k * 10,
    vx: side * (10 + Math.random() * 14) * (dot ? 0.4 : 1),
    color: crit ? "#ffd24a" : dot ? "#ff7a7a" : tg ? (v >= 5 ? "#ffe08a" : "#fff3d0") : color || "#ff9a9a",
    base: crit ? 18 : dot ? 10 : v >= 5 ? 14 : 12,
    life: 1,
    t0: now,
    age: 0,
    bump: crit ? 0.6 : 0,
  });
}
// etapa de spawnDungeonToast: v4.7
function spawnDungeonToastBase2(text: string, x: number, y: number, color: string, size: number, font?: string) {
  /* v4.7 */
  const I = toastIcon(text);
  if (!I) return spawnDungeonToastBase(text, x, y, color, size, font);
  if (!I.ic) return;
  dungeon.toasts.push({ text: I.ic, x, y: y + 4, color: I.col || color || "#fff8e3", life: 1.0, size: 20, icon: true });
}
// etapa de spawnDungeonToast: original
function spawnDungeonToastBase(text: string, x: number, y: number, color: string, size: number, font?: string) {
  dungeon.toasts.push({ text, x, y, color, life: font ? 1.35 : 1.0, size, font });
}
export function updateWeaponUI() {
  const _g = document.getElementById("dungeon-guard");
  if (_g) _g.style.display = dungeon.weapon === "melee" ? "" : "none";
  const b = document.getElementById("dungeon-weapon");
  if (b) b.textContent = WEAPONS[dungeon.weapon!].label + " (Q)";
  const k = document.getElementById("dungeon-hint");
  if (k)
    k.textContent =
      (OPT.ataqueAutomatico
        ? "TESTE: clique esquerdo no inimigo = básicos automáticos ao alcance · Esc ou clique no chão = parar · "
        : "Clique esquerdo = um golpe manual · ") +
      "Botão direito = especial da arma · " +
      (dungeon.weapon === "bow"
        ? "Arco: ande com WASD, CLIQUE ESQUERDO no bicho para MARCAR, SEGURE o botão DIREITO para puxar a corda (mira no mouse) e SOLTE para atirar. Quanto mais você segura, mais forte a corda: mais alcance e dano (andando carrega mais devagar). Carga máxima empurra só quem está perto; o dano vem em impacto + sangramento. Alvo marcado leva +50%. Espaço = ROLAMENTO curto (os golpes passam direto; esquivar de um golpe deixa a próxima flecha já carregada; gasta fôlego). E interage (pegar itens / voltar ao mapa no círculo verde) · C abre o craft."
        : wpnKey(dungeon.hero!) === "eq_machado"
          ? "Machado: CLIQUE = golpe em arco largo (pode sangrar) · SEGURE o botão DIREITO para erguer o machado (gasta fôlego e anima a preparação) e SOLTE para o GOLPE PESADO. Mire e chegue perto de uma árvore ou pedra para cortar/minerar; golpes carregados quebram mais rápido e os materiais vão para a personagem. Contra bichos, mais carga prolonga o efeito ALEIJADO. Espaço = escudo · F = fogueira · E = interagir."
          : wpnKey(dungeon.hero!) === "eq_clava"
            ? "Clava: os básicos carregam um COMBO de 2 golpes; no modo manual, segure o esquerdo (soltar antes cancela) · SEGURE o botão DIREITO por mais tempo: cheio, SOLTE: cedo = nada, a partir de 1/3 = golpe médio (55% de atordoar), cheio = PORRADÃO (dano cheio, 89% de atordoar) · os golpes da clava BLOQUEIAM o ataque do bicho (bote do lobo, corrida do javali) como um parry. Espaço = escudo · F = fogueira · E = interagir."
            : isLanca(wpnKey(dungeon.hero!)) || dungeon.spearOut
              ? "Lança: CLIQUE = estocada reta (alcance longo, faixa estreita) · SEGURE o botão DIREITO para mirar e SOLTE para arremessar — no CRÍTICO a lança pode CRAVAR no bicho (60%) e faz sangrar; chegue perto e clique (ou E) para ARRANCAR com dano extra · ESPAÇO = EMPURRÃO com a haste no tempo do golpe: anel BRANCO = perfeito (DERRUBA, +30% de dano nele), LARANJA = quase (empurra e cancela o golpe), cedo/fora = erro · leve outras lanças na mochila para trocar · E pega a lança do chão."
              : "Espada: combo de 3 golpes · SEGURAR Espaço = ESCUDO (de frente bloqueia todo o dano e o lobo não passa; cada golpe bloqueado gasta fôlego) · Shift = CORRER (mesmo fôlego) · segurar o botão DIREITO aciona PARRY: anel LARANJA = quase, anel BRANCO = perfeito (te deixa invulnerável por 2,5 s). E = INTERAGIR: pega o item no chão e, no círculo verde, volta ao mapa. O círculo verde é ZONA SEGURA (os lobos não te veem; atacar de dentro te revela por 3 s). C = craft (galhos, pedras e ervas pelo chão). CLIQUE NO CHÃO = golpe de espada (3 cliques seguidos = combo; ande com WASD). Parry só de FRENTE (o círculo branco do lobo precisa tocar o arco). Os lobos MORDEM (rápido, bem de perto) e dão BOTE (salto em linha: saia da linha vermelha; parry no bote também vale). Cumpra 3 hordas + o Lobo Alfa.");
  /* v5.9.03 — nome da arma e conjunto no botão */
  {
    const b = document.getElementById("dungeon-weapon"),
      h = dungeon.hero;
    if (b && h) {
      const e = ensureEquip(h),
        it = dungeon.weapon === "bow" ? e.costas : e.maoD || e.maoE;
      b.textContent =
        (dungeon.weapon === "bow" ? "🏹 " : "⚔ ") + (it ? it.def.name : "Punhos") + " · " + setNo(h) + " (Q)";
    }
  }
  /* v6.3 — a dica some sozinha */
  try {
    const el = document.getElementById("dungeon-hint");
    if (el && el.classList.contains("show") && (econ.hintRuns || 0) > 1) el.classList.remove("show");
    if (el) {
      clearTimeout(el._t);
      el._t = setTimeout(() => el.classList.remove("show"), 8000);
    }
  } catch (_) {}
}
export function switchWeapon() {
  // reescrita na v5.9.03
  const d = dungeon;
  if (!d.active) return;
  d.alvoAutomatico = null;
  const h = d.hero!,
    e = ensureEquip(h),
    cur = setNo(h),
    oth = cur === 1 ? 2 : 1;
  const st = [{ s: cur, w: "melee" }];
  if (e.costas) st.push({ s: cur, w: "bow" });
  if (e.maoD2 || e.maoE2) st.push({ s: oth, w: "melee" });
  if (e.costas2) st.push({ s: oth, w: "bow" });
  if (st.length === 1) {
    spawnDungeonToast("Sem arco nem Arma 2 — equipe no boneco (I)", d.px, d.py - 28, "#ff9a9a", 11);
    return;
  }
  const i = st.findIndex((x) => x.s === cur && x.w === d.weapon),
    nx = st[(i + 1) % st.length];
  d.charging = false;
  d.charge = 0;
  d.hv = null;
  d.spCh = null;
  d.guard = false;
  if (nx.s !== cur) swapSet(h);
  d.weapon = nx.w;
  d.cd = 0.5;
  GL3.heroKey = "";
  const it = nx.w === "bow" ? e.costas : e.maoD || e.maoE;
  spawnDungeonToast("Arma " + nx.s + ": " + (it ? eqName(it) : "punhos"), d.px, d.py - 28, "#fff8e3", 12);
  updateWeaponUI();
  if (d.invOpen) renderInv();
}
// ---- faixa "Equipado" na mochila da masmorra ----
export function dEqRender() {
  const card = document.getElementById("inv-card");
  if (!card || !dungeon.active) return;
  let bar = document.getElementById("inv-eq");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "inv-eq";
    const g = document.getElementById("inv-grid")!;
    g.parentNode!.insertBefore(bar, g);
    bar.addEventListener("click", (ev) => {
      const s = (ev.target as HTMLElement).closest("[data-eqs]") as HTMLElement;
      if (s) dEqTake(s.dataset.eqs!, false);
    });
    bar.addEventListener("contextmenu", (ev) => {
      const s = (ev.target as HTMLElement).closest("[data-eqs]") as HTMLElement;
      if (!s) return;
      ev.preventDefault();
      dEqTake(s.dataset.eqs!, true);
    });
  }
  const h = dungeon.hero!,
    e = ensureEquip(h);
  bar.innerHTML =
    '<b class="ieq-l">Equipado</b>' +
    EQ_SLOTS.map((s) => {
      const it = e[s.id];
      return (
        '<div class="ieq' +
        (it ? "" : " empty") +
        '" data-eqs="' +
        s.id +
        '" title="' +
        (it
          ? eqName(it) + " — clique: guardar na mochila · clique direito: largar no chão"
          : s.label + ": vazio — arraste um item para cá") +
        '">' +
        (it ? icoItemQ(it) : '<span style="opacity:.3">' + s.icon + "</span>") +
        "</div>"
      );
    }).join("") +
    '<small class="ieq-h">clique: guardar · clique direito: largar</small>';
}
export function dEqTake(slot: string, toGround: boolean) {
  const d = dungeon,
    h = d.hero!,
    e = ensureEquip(h),
    it = e[slot];
  if (!it) return;
  if (slot === "maoD" && d.spearOut) d.spearOut = null;
  if (toGround) {
    e[slot] = null;
    if (!d.gInv) buildGroundInv();
    let sh = it.shape,
      ok = false;
    for (let r = 0; r < 4 && !ok; r++) {
      for (let y = 0; y < d.gInv!.rows && !ok; y++)
        for (let x = 0; x < d.gInv!.cols && !ok; x++)
          if (canPlace(d.gInv!, sh, x, y)) {
            it.x = x;
            it.y = y;
            it.shape = sh;
            d.gInv!.items.push(it);
            ok = true;
          }
      sh = rotShape(sh);
    }
    groundPut(it);
  } else {
    const msg = unequip(h, slot, ensureInv(h));
    if (msg) spawnDungeonToast(msg, d.px, d.py - 50, "#ffe08a", 12);
  }
  if (slot === "costas" && d.weapon === "bow" && !e.costas) switchWeapon();
  GL3.heroKey = "";
  renderInv();
}

export function playTransition(onMid: () => void, totalMs: number) {
  const el = document.getElementById("portal-transition")!;
  el.classList.add("active");
  setTimeout(onMid, totalMs * 0.5);
  setTimeout(() => el.classList.remove("active"), totalMs);
}
export function setBanner(text: string, sub: string, t: number, col?: string) {
  /* v4.7 */
  if (!OPT.textos && sub)
    for (const [re, rp] of BANNER_SUBS) {
      const m = String(sub).match(re);
      if (m) {
        sub = typeof rp === "function" ? rp(m) : rp;
        break;
      }
    }
  dungeon.banner = { text, sub, t, max: t, col: col || "#ffe08a" };
}
export function spawnDungeonMonster(o?: { boss?: boolean; hpMult?: number; spdMult?: number }) {
  o = o || {};
  const d = dungeon,
    T = d.tile,
    margin = T * 1.5;
  let x,
    y,
    tries = 0;
  do {
    x = margin + Math.random() * (d.cols * T - margin * 2);
    y = margin + Math.random() * (d.rows * T - margin * 2);
  } while (
    tries++ < 40 &&
    (Math.hypot(x - d.px, y - d.py) < T * 5 || Math.hypot(x - d.entrance.x, y - d.entrance.y) < T * 3.2)
  );
  const pp = pontoPerto(6); // v8.0: no campo aberto, perto de onde ela anda e em terra (map/mundo.ts)
  if (pp) ({ x, y } = pp);
  const hpMax = Math.round((o.boss ? 110 : 22) * (o.hpMult || 1));
  const m: Monster = {
    name: o.boss ? "Lobo Alfa" : "Lobo da Masmorra",
    x,
    y,
    target: null,
    hp: o.boss ? hpMax : hpMax * (0.75 + Math.random() * 0.25),
    hpMax,
    alive: true,
    st: "wander",
    t: 0,
    boss: !!o.boss,
    wu: o.boss ? 0.95 : 0.75,
    dm: o.boss ? 1.7 : 1,
    spd: (o.boss ? 46 : 38) * (o.spdMult || 1),
    ang: 0,
    atk: "bite",
    pcd: 1 + Math.random() * 2.5,
    coat: o.boss ? 2 : Math.floor(Math.random() * 6),
    sex: Math.random() < 0.5 ? "M" : "F", // v7.7: o sexo é do bicho (a captura guarda o mesmo, campanha/lobos.ts)
  };
  if (!o.boss && !o.hpMult && d.origem) nivelLobo(m); // v8.0: no campo aberto, jovem/adulto/veterano
  d.monsters.push(m);
  addRing(x, y, o.boss ? "#ff6b6b" : "#c9a2ff", o.boss ? 70 : 34, 0.5, 3);
  return m;
}
/** v8.0 — o nível do lobo no campo aberto (LOBO_NIVEL): mais longe do acampamento e à noite, mais forte. */
function nivelLobo(m: Monster) {
  const L = LOBO_NIVEL,
    h = dungeon.hero,
    c = h && h.camp,
    longe = c ? Math.hypot(h.x - c.x, h.y - c.y) / L.longe : 0,
    n = longe + (ehNoite() ? L.noite : 0) + (Math.random() - 0.5) * L.sorte,
    tipo = n < L.jovem ? "jovem" : n >= L.veterano ? "veterano" : "adulto",
    T = L.tipos[tipo];
  m.nivel = tipo;
  m.prof = T.prof;
  if (tipo !== "adulto") m.name = T.nome;
  m.hpMax = T.hp;
  m.hp = T.hp * (0.75 + Math.random() * 0.25);
  m.dm = T.dm;
  m.spd = m.spd! * T.spd;
}
function birdSpot() {
  const d = dungeon,
    T = d.tile;
  let x,
    y,
    n = 0;
  do {
    x = T * 1.8 + Math.random() * (d.cols * T - T * 3.6);
    y = T * 1.8 + Math.random() * (d.rows * T - T * 3.6);
  } while (n++ < 40 && Math.hypot(x - d.entrance.x, y - d.entrance.y) < T * 3.4);
  return { x, y };
}
export function spawnBird() {
  const p = birdSpot();
  dungeon.birds!.push({
    kind: "bird",
    name: "Pássaro",
    x: p.x,
    y: p.y,
    hp: 1,
    hpMax: 1,
    alive: true,
    st: "idle",
    t: 0,
    tx: p.x,
    ty: p.y,
    vr: Math.random() * 8,
  });
}
function startExpedition(this: unknown) {
  const r = startExpeditionBase2.apply(this, arguments as Repasse);
  /* v6.8 */
  try {
    if (dungeon.mode === "campo") {
      campoPovoar();
      cacadaNoCampo(); // v7.7: veio de uma caçada do mapa: a presa
    }
  } catch (e) {
    console.warn(e);
  }
  return r;
}
// etapa de startExpedition: v6.5
function startExpeditionBase2(this: unknown) {
  if (!JOGO.pending) return startExpeditionBase.apply(this, arguments as Repasse);
  JOGO.pending = false;
  const d = dungeon;
  d.birds = [];
  d.birdQ = [];
  d.mode = "campo";
  d.flow = "campo";
  d.wave = 0;
  try {
    moitaSpawn();
  } catch (_) {}
  setBanner("🌲 Campo", (MOB.on ? "pinça para fora" : "role o mouse para trás") + " para abrir o mapa", 4.5, "#9fe38a");
}
// etapa de startExpedition: original + v6.4
function startExpeditionBase() {
  const d = dungeon;
  d.birds = [];
  d.birdQ = [];
  for (let i = 0; i < 4; i++) spawnBird();
  d.mode = "expedition";
  d.wave = 0;
  d.flow = "warmup";
  d.flowT = 4.5;
  d.resT = 0;
  d.expT = 0;
  setBanner("⚔ EXPEDIÇÃO", "3 hordas e um chefe · E interage · o círculo verde é zona segura", 4.5);
  /* v6.4 */
  try {
    moitaSpawn();
  } catch (_) {}
}
function bossDefeated() {
  const d = dungeon;
  if (d.mode !== "expedition") return;
  d.flow = "complete";
  d.flowT = 60;
  d.lootWarn = false;
  forgeBossDrop(); // 1 minuto para coletar o loot; depois começa a sobrevivência sozinha
  for (const m of d.monsters)
    if (m.alive) {
      m.alive = false;
      addRing(m.x, m.y, "#c9a2ff", 30, 0.4, 3);
    }
  setBanner(
    "🏆 HORDA FINALIZADA!",
    "Você tem 1 min para coletar o loot · depois começa a Sobrevivência (saia pelo círculo verde com E se quiser)",
    6,
    "#ffe08a",
  );
  sfx("perfect");
  shakeScreen(0.3, 5);
  pushEvent(d.hero!.name + " concluiu a expedição: 3 hordas e o Lobo Alfa foram derrotados!");
}
export function onMonsterKilled(m: Monster) {
  if (m && m.cacada) cacadaAbatida(m); // v7.7: a presa da caçada (v8.0: o lobo também)
  /* v6.8 */
  if (m && m.critter) {
    try {
      addHeroXp(dungeon.hero!, 3);
      gainSkill(dungeon.hero!, "caca", 2);
    } catch (_) {}
    return;
  }
  /* v6.1 */
  if (dungeon.mode === "intro") return;
  /* v5.0 */
  if (!dungeon.training) return onMonsterKilledBase(m);
  const sess = dungeon.sess;
  if ((m.humano && TR.human) || (!m.humano && TR.wolf))
    setTimeout(() => {
      if (!dungeon.active || !dungeon.training || dungeon.sess !== sess) return;
      if (m.humano && TR.human) trainHuman();
      else if (!m.humano && TR.wolf) trainWolf();
    }, 1800);
}
// etapa de onMonsterKilled: original
function onMonsterKilledBase(m: Monster) {
  const d = dungeon,
    sess = d.sess;
  addHeroXp(d.hero!, m.boss ? 40 : 10);
  if (nodeRank(HERO()!, "rastreador")) {
    let b = null,
      bd = 1e9;
    for (const o of d.monsters)
      if (o.alive && o !== m) {
        const dd = Math.hypot(o.x - d.px, o.y - d.py);
        if (dd < bd) {
          bd = dd;
          b = o;
        }
      }
    if (b) {
      d.foco = b; // v7.7: marcado = foco (o alvo prioritário é só automático)
      spawnDungeonToast("Rastreado", b.x, b.y - 36, "#ffe08a", 11);
    }
  }
  if (m.boss) {
    bossDefeated();
    return;
  }
  if (d.mode === "survival")
    setTimeout(() => {
      if (dungeon.active && dungeon.sess === sess && dungeon.mode === "survival" && !dungeon.dead)
        spawnDungeonMonster();
    }, 4500);
}
function spawnGround(this: unknown, n: number) {
  /* v7.0 */
  if (dungeon.mode !== "campo") return spawnGroundBase.apply(this, arguments as Repasse);
  // No campo ligado ao mapa, galho no chão só aparece quando uma árvore é derrubada.
  if (dungeon.origem) return spawnGroundBase.apply(this, arguments as Repasse);
  for (let i = 0; i < n; i++) {
    if (Math.random() < CAMPO_CHAO.galhoChance) groundAt("galho");
    else spawnGroundBase.call(this, 1);
  }
}
// etapa de spawnGround: original
function spawnGroundBase(n: number) {
  const d = dungeon,
    T = d.tile,
    kinds = CHAO_KINDS;
  for (let i = 0; i < n; i++) {
    let x,
      y,
      t = 0;
    do {
      x = T * 1.6 + Math.random() * (d.cols * T - T * 3.2);
      y = T * 1.6 + Math.random() * (d.rows * T - T * 3.2);
    } while (t++ < 30 && Math.hypot(x - d.entrance.x, y - d.entrance.y) < T * 1.8);
    const pp = pontoPerto(1.8); // v8.0: no campo aberto, perto dela e em terra
    if (pp) ({ x, y } = pp);
    d.loot!.push({ key: kinds[Math.floor(Math.random() * kinds.length)], x, y, ground: true, t: 0, ttl: 0 });
  }
}
function seedDungeonFloor() {
  spawnGround(14);
  runeSeedDungeon();
  hintShowOnce();
  dungeon.spears = [];
  dungeon.spearOut = null;
  dungeon._spearWarn = 0;
  dungeon.dodge = null;
  dungeon.dodgeGuard = 0;
  dungeon.rollGuard = 0;
  dungeon.gingaGuard = 0;
  dungeon.quickShot = 0;
  dungeon.spCh = null;
  dungeon.down = 0;
  dungeon.derrubada = 0;
  dungeon.dazed = 0;
}
export function setupDungeon(hero: Hero) {
  /* v6.4 · v6.2 · v5.9.02 — zera moitas, arma cravada, fogueiras e coleta */
  limparRegistroRecursosCampo();
  dungeon.bushes = [];
  dungeon.crav = null;
  dungeon.noAtk = 0;
  dungeon.fires = [];
  dungeon.hv = null;
  dungeon.golpeMachado = null;
  /* v5.9 — entrando no acampamento? */
  dungeon.camp = !!CPS.pending;
  dungeon.vila = false; // v8.0: a vila andável liga em vilaSetup (map/vila_cena.ts)
  /* v5.0 — tamanho do mapa: a Dungeon Teste é OUTRO mapa (campo de treino), menor e cercado; o acampamento também */
  const S = TR.pending
    ? TR_SIZE
    : typeof CPS !== "undefined" && CPS.pending
      ? CPS.size
      : VCS.pending
        ? VILA_CENA
        : DG_SIZE;
  dungeon.cols = S.cols;
  dungeon.rows = S.rows;
  dungeon.training = !!TR.pending;
  ensureHero(hero);
  dungeon.hpTrail = null;
  dungeon.sinceHurt = 99;
  dungeon.riposte = 0;
  dungeon.boost = 0;
  dungeon.hurtVig = 0;
  dungeon.hitDirs = [];
  dungeon.hero = hero;
  dungeon.hpMax = hero.hpMax;
  dungeon.hp = Math.max(hero.hp || hero.hpMax, Math.round(hero.hpMax * 0.4));
  dungeon.entrance = { x: dungeon.tile * 1.5, y: (dungeon.rows * dungeon.tile) / 2 };
  dungeon.px = dungeon.entrance.x;
  dungeon.py = dungeon.entrance.y;
  /* v8.0 — mundo ligado: o campo aberto pelo mapa é o pedaço do mapa em volta dela (map/mundo.ts) */
  dungeon.origem = null;
  bichosSoltar();
  if (JOGO.pending && !dungeon.camp && !TR.pending) mundoEntrar(hero);
  dungeon.moveTarget = null;
  dungeon.monsters = [];
  dungeon.toasts = [];
  dungeon.pegadas = [];
  dungeon.fezes = [];
  dungeon.sangue = [];
  dungeon.active = true;
  clearInterval(dungeon.combatInterval!);
  dungeon.dead = false;
  dungeon.guard = false;
  dungeon.invOpen = false;
  dungeon.parts = [];
  dungeon.loot = [];
  dungeon.parryCd = 0;
  dungeon.parryVis = 0;
  ensureInv(hero);
  document.getElementById("inv-modal")!.classList.remove("open");
  seedDungeonFloor();
  dungeon.charging = false;
  dungeon.charge = 0;
  dungeon.keys = {};
  dungeon.mouse = null;
  dungeon.weapon = "melee";
  dungeon.target = null;
  dungeon.alvoAutomatico = null;
  dungeon.especialPressionado = false;
  dungeon.foco = null;
  dungeon.cd = 0;
  dungeon.arrows = [];
  dungeon.fx = [];
  dungeon.combatInterval = null;
  dungeon.rings = [];
  dungeon.gstam = 100;
  dungeon.gint = 100;
  dungeon.fatorCorrida = 1;
  dungeon.combateHumanoT = 0;
  dungeon.debilitadoT = 0;
  dungeon.debilitadoN = 0;
  dungeon.debilitadoJanela = 0;
  dungeon.exaustaoArmada = false;
  dungeon._zerouInt = dungeon._quedaInt = false;
  dungeon.guardBroken = 0;
  dungeon.gregen = 0;
  dungeon.pkx = 0;
  dungeon.pky = 0;
  dungeon.shake = 0;
  dungeon.invuln = 0;
  dungeon.runLock = false;
  dungeon.running = false;
  dungeon.hotLeft = 0;
  dungeon.hotT = 0;
  dungeon.keys = {};
  updateWeaponUI();
  dungeon.sess = (dungeon.sess || 0) + 1;
  dungeon.craftOpen = false;
  dungeon.modalOpen = false;
  dungeon.revealT = 0;
  dungeon.banner = null;
  dungeon.sparks = [];
  dungeon.cuts = [];
  dungeon.ghosts = [];
  dungeon.hitStop = 0;
  document.getElementById("exp-modal")!.style.display = "none";
  startExpedition();
  /* v5.0 — vida pelos atributos; sala de treino */
  dungeon.training = false;
  dungeon.hpMax = hpMaxOf(hero);
  dungeon.hp = Math.min(dungeon.hp, dungeon.hpMax);
  if (TR.pending) {
    TR.pending = false;
    trainSetup();
  } else trainHud(false);
  /* v5.9 — o ferimento do herói entra junto */
  {
    const d = dungeon;
    d.wound = Math.min(d.hpMax * 0.85, hero.wound || 0);
    if (d.hp > hpCap()) d.hp = hpCap();
  }
  if (CPS.pending) {
    CPS.pending = false;
    campSetup();
  }
  if (VCS.pending) {
    VCS.pending = false;
    vilaSetup();
  }
  /* v5.9.04 — o tamanduá vem junto (ou espera no acampamento) */
  {
    const d = dungeon,
      m = mnt(),
      T = d.tile;
    d.mount = null;
    if (m && (m.with === hero.id || (d.camp && !m.with))) {
      if (d.camp && !m.with) m.with = null;
      d.mount = {
        x: d.camp && CPS.fire ? CPS.fire.x - T * 2.8 : d.px - T * 0.9,
        y: d.camp && CPS.fire ? CPS.fire.y - T * 1.4 : d.py + T * 0.8,
        ang: 0,
        mounted: false,
        st: "roam",
        ph: 0,
        mv: 0,
        flee: 0,
        hp: m.hp || 100,
      };
    }
  }
  /* v6.1 — cena inicial */
  if (ISC.pending) {
    ISC.pending = false;
    try {
      introSetup();
    } catch (e) {
      console.error(e);
    }
  }
}

/* ---------- pedras: inspecionar (chance de minério) ---------- */
export function inspectStone(it: Item, gr: GradeTela) {
  const n = it.n || 1,
    done = it.insp || 0;
  if (done >= n) return "Todas as pedras desta pilha já foram examinadas.";
  let r = Math.random(),
    got = null;
  for (const [k, p] of ORE_TABLE) {
    if (r < p) {
      got = k;
      break;
    }
    r -= p;
  }
  if (!got) {
    it.insp = done + 1;
    return "🔍 Só pedra comum." + (n - it.insp > 0 ? " (" + (n - it.insp) + " ainda sem examinar)" : "");
  }
  const ore = mkItem(got);
  it.n = n - 1;
  if (it.n <= 0) gr.inv.items.splice(gr.inv.items.indexOf(it), 1);
  if (!placeIn(gr.inv, ore)) {
    if (dungeon.active && dungeon.invOpen) {
      if (!dungeon.gInv) buildGroundInv();
      if (!placeIn(dungeon.gInv!, ore)) dungeon.gInv!.items.push(ore);
      groundPut(ore);
    } else if (!placeIn(econ.stash, ore)) {
      it.n = (it.n || 0) + 1;
      if (it.n === 1 && gr.inv.items.indexOf(it) < 0) gr.inv.items.push(it);
      return "Sem espaço para o minério — libere a mochila.";
    }
  }
  return "✨ Era " + ore.def.name + "! " + ore.def.desc;
}
export function dSafe() {
  // zona segura: os lobos não te veem (atacar te revela por 3 s)
  const d = dungeon;
  if (d.mode === "campo" && !d.dead && !(d.revealT! > 0) && inMoita && inMoita()) return true; // v6.5: no Campo do tutorial a moita esconde
  const cenaJavali = ISC.on && ISC.ph === "boar" && d.mode === "intro"; // v6.1: na cena inicial o javali sempre te vê
  if (!cenaJavali && !d.dead && !(d.revealT! > 0) && inExitZone()) return true;
  if (d.dead || d.revealT! > 0 || d.mode !== "expedition") return false; // v6.4: na expedição, dentro da moita também
  return !!inMoita();
}
export function reveal() {
  /* v6.4 */
  {
    const d = dungeon;
    if (inMoita() && !(d.revealT! > 0)) spawnDungeonToast("Você se revelou!", d.px, d.py - 40, "#ffb37a");
  }
  if (inExitZone() && !(dungeon.revealT! > 0))
    spawnDungeonToast("Você se revelou!", dungeon.px, dungeon.py - 40, "#ffb37a");
  dungeon.revealT = 3;
}
export function livingMonsters() {
  let n = 0;
  for (const m of dungeon.monsters) if (m.alive) n++;
  return n;
}
export function beginWave(n: number) {
  const d = dungeon,
    cnt = EXP_WAVES[n - 1];
  d.wave = n;
  d.flow = "wave";
  if (n >= 2) spawnJavalino(n);
  for (let i = 0; i < cnt; i++) spawnDungeonMonster({ hpMult: 1 + (n - 1) * 0.15, spdMult: 1 + (n - 1) * 0.05 });
  setBanner("🐺 HORDA " + n + "/" + EXP_WAVES.length, cnt + " lobos" + (n >= 2 ? " + 1 javalino" : ""), 3, "#ffb37a");
  shakeScreen(0.2, 3);
}
function beginBoss() {
  const d = dungeon;
  d.flow = "boss";
  spawnDungeonMonster({ boss: true });
  setBanner("👑 LOBO ALFA", "Muito mais vida e golpes bem mais fortes", 3.5, "#ff6b6b");
  shakeScreen(0.4, 6);
  sfx("guardbreak");
}
export function startSurvival() {
  const d = dungeon,
    sess = d.sess;
  d.mode = "survival";
  d.flow = "survival";
  setBanner(
    "☠ MODO SOBREVIVÊNCIA",
    "Os lobos vão aparecendo · saia pelo círculo verde (E) quando quiser",
    5,
    "#ff9a9a",
  );
  pushEvent(d.hero!.name + " ficou na masmorra: modo sobrevivência.");
  [1500, 3500, 5500].forEach((ms) =>
    setTimeout(() => {
      if (dungeon.active && dungeon.sess === sess && dungeon.mode === "survival" && !dungeon.dead)
        spawnDungeonMonster();
    }, ms),
  );
}
export function updateDungeonFlow(dt: number) {
  updateDungeonFlowBase(dt);
  /* v6.8 — repovoa devagar */
  try {
    const d = dungeon;
    mundoTick(dt); // v8.0: a heroína e os bichos andam no mapa junto (map/mundo.ts)
    if (d.active && d.mode === "campo" && dt > 0) {
      d.campoT = (d.campoT || 0) + dt;
      if (d.campoT > CAMPO_VIDA.respawn) {
        d.campoT = 0;
        const n = d.monsters.filter((m) => m.alive && m.critter).length,
          sp = Math.random() < 0.7 ? "rabbit" : "deer";
        // v8.0: no campo aberto os bichos vêm do mapa; só repovoa se ele estiver vazio ali (e nasce no mapa também)
        if (d.origem) {
          if (n < 2) bichoNovo(sp);
        } else if (n < 5) critSpawn(sp, true);
      }
      cacadaTick(dt); // v7.7: cronômetro da caçada
      rastroTick(dt); // v8.0: as pegadas da presa
      caminhadaTick(); // v8.0: a caminhada do fim da cena inicial até a base
    }
    acampamentoCampoTick(); // v8.1: o marcador e, chegando à fogueira no campo aberto, a entrada no acampamento
    perigoCampoTick(dt); // v8.1: o chefe da Runa Selvagem, o contador da ajuda e as flechas dos reforços
  } catch (_) {}
}
function updateDungeonFlowBase(dt: number) {
  const d = dungeon;
  if (!d.active || dt <= 0) return;
  if (d.revealT! > 0) d.revealT! -= dt;
  if (d.banner) {
    d.banner.t -= dt;
    if (d.banner.t <= 0) d.banner = null;
  }
  if (d.dead) return;
  d.sinceHurt = (d.sinceHurt || 0) + dt;
  if (d.riposte! > 0) d.riposte! -= dt;
  if (d.boost! > 0) d.boost! -= dt;
  if (d.hpBarShake! > 0) d.hpBarShake! -= dt;
  if (d.xpPulso! > 0) d.xpPulso! -= dt;
  {
    const hh = HERO()!,
      con = attrOf(hh, "constituicao");
    if (d.sinceHurt > 6 && d.hp < hpCap() && (d.training || (hh.hunger || 0) <= 85))
      d.hp = Math.min(hpCap(), d.hp + (0.12 + con * 0.025) * dt);
    hh.mana = Math.min(hh.manaMax, (hh.mana || 0) + (0.2 + con * 0.03) * dt);
  }
  for (let i = d.birdQ!.length - 1; i >= 0; i--) {
    d.birdQ![i] -= dt;
    if (d.birdQ![i] <= 0) {
      d.birdQ!.splice(i, 1);
      spawnBird();
    }
  }
  d.resT = (d.resT || 0) + dt; // galhos, pedras e ervas voltam devagar
  if (d.resT >= 26) {
    d.resT = 0;
    let n = 0;
    for (const l of d.loot!) if (l.ground) n++;
    if (n < 14) spawnGround(1);
  }
  if (d.mode !== "expedition") return;
  d.flowT! -= dt;
  if (d.flow === "complete") {
    // tempo de coleta depois do chefe
    if (!d.lootWarn && d.flowT! <= 10) {
      d.lootWarn = true;
      setBanner("☠ Sobrevivência em 10s", "Saia pelo círculo verde (E) se quiser voltar com o loot", 4, "#ff9a9a");
    }
    if (d.flowT! <= 0) startSurvival();
    return;
  }
  if (d.flow === "warmup" && d.flowT! <= 0) beginWave(1);
  else if (d.flow === "wave" && livingMonsters() === 0) {
    if (d.wave < EXP_WAVES.length) {
      d.flow = "between";
      d.flowT = 7;
      setBanner(
        "Horda " + d.wave + " derrotada!",
        "Próxima horda em 7s · recupere o fôlego, junte itens (E) ou craft (C)",
        5,
        "#7dff9a",
      );
    } else {
      d.flow = "bossWarn";
      d.flowT = 6;
      setBanner("👑 O Lobo Alfa se aproxima…", "Prepare-se", 5, "#ff9a9a");
    }
  } else if (d.flow === "between" && d.flowT! <= 0) beginWave(d.wave + 1);
  else if (d.flow === "bossWarn" && d.flowT! <= 0) beginBoss();
}
export function collectLoot(l: LootChao) {
  /* v5.9.07 — de que bicho veio a carne (tryAddToInv lê MEAT_SRC) */
  CACA.MEAT_SRC = (l && (l.an || (l.key === "carne" ? "lobo" : null))) || null;
  try {
    /* v5.9.05 — coletar do chão treina Coletor */
    const d = dungeon,
      n0 = d.loot!.length;
    collectLootBase(l);
    if (l && l.ground && d.loot!.length < n0 && d.hero) gainSkill(d.hero, "coletor", 1);
    if (d.loot!.length < n0) heroinaColetar(); // v7.7: a heroína agacha para pegar
  } finally {
    CACA.MEAT_SRC = null;
  }
}
function collectLootBase(l: LootChao) {
  /* v5.9 — galho no acampamento vira lenha */
  {
    const d = dungeon;
    if (d.camp && l && l.ground && l.key === "galho") {
      const i = d.loot!.indexOf(l);
      if (i >= 0) d.loot!.splice(i, 1);
      const h = d.hero!;
      h.loot = h.loot || {};
      h.loot.wood = (h.loot.wood || 0) + 1;
      spawnDungeonToast("+1 🪵 lenha", l.x, l.y - 14, "#e0c08a");
      return;
    }
  }
  /* v5.8 — item com identidade (equipamento solto) vai inteiro para a mochila */
  if (l && l.it) {
    const d = dungeon,
      h = d.hero!,
      it = l.it,
      idx = d.loot!.indexOf(l);
    /* v7.7 — mochila/aljava no chão: sem uma no corpo, veste; com uma, ela não entra na outra (items/mochilas.ts) */
    if (ehBolsa(it)) {
      if (ensureEquip(h)[it.def.slot!]) {
        spawnDungeonToast(
          "Já está de " + it.def.name.toLowerCase() + ": guarde esta nos alforjes",
          d.px,
          d.py - 28,
          "#ffb37a",
          12,
        );
        return;
      }
      delete it._loot;
      if (idx >= 0) d.loot!.splice(idx, 1);
      spawnDungeonToast(vestirBolsa(h, it), d.px, d.py - 28, "#ffe08a", 12);
      return;
    }
    if (placeIn(ensureInv(h), it)) {
      delete it._loot;
      if (idx >= 0) d.loot!.splice(idx, 1);
      spawnDungeonToast("+ " + eqName(it), l.x, l.y - 14, "#ffe08a");
    } else spawnDungeonToast("Mochila cheia!", d.px, d.py - 28, "#ff9a9a");
    return;
  }
  const d = dungeon,
    h = d.hero!,
    def = lootInfo(l),
    idx = d.loot!.indexOf(l),
    nm = lootName(l);
  if (def.flechas) {
    // v8.0: flecha no chão vai para a aljava
    const q = econ.quiver,
      t = Math.min(Math.max(0, arrowCap(h) - q.n), def.flechas * (l.n || 1));
    if (t <= 0) {
      spawnDungeonToast("A aljava está cheia", d.px, d.py - 28, "#ff9a9a");
      return;
    }
    q.n += t;
    spawnDungeonToast("+" + t + " " + def.name, l.x, l.y - 14, "#cfe8a0");
    d.loot!.splice(idx, 1);
    updateEcon();
    return;
  }
  if (def.res) {
    if (resAdd(h, def.res, l.n || 1, true)) {
      spawnDungeonToast("Mochila e aljava cheias!", d.px, d.py - 28, "#ff9a9a");
      return;
    }
    spawnDungeonToast("+1 " + def.name, l.x, l.y - 14, "#cfe8a0");
    d.loot!.splice(idx, 1);
    updateEcon();
    return;
  }
  const key = def.item || l.key;
  const _dst = tryAddItem(h, key, l.tier) ? ensureInv(h) : tryAddQuiver(h, key, l.tier) ? qvInv(h) : null;
  if (_dst) {
    if ((l.n || 1) > 1) _dst.items[_dst.items.length - 1].n = l.n;
    spawnDungeonToast("+ " + nm, l.x, l.y - 14, l.tier ? TIERS[l.tier].col : "#ffe08a");
    d.loot!.splice(idx, 1);
  } else spawnDungeonToast("Mochila cheia!", d.px, d.py - 28, "#ff9a9a");
}
export function interact() {
  // E: pega o item mais próximo; sem item por perto, sai pelo círculo verde
  const d = dungeon;
  /* v8.0 — a vila andável: na porta, o E abre o lugar (map/vila_cena.ts) */
  if (d.active && d.vila && !d.dead && !d.invOpen && !d.modalOpen) {
    const l = vilaPerto();
    if (l) {
      vilaAbrir(l);
      return;
    }
  }
  /* v8.0 — sala de treino: E num manequim veste a heroína com aquele personagem (render/gl/vestidos.ts) */
  if (d.active && d.training && !d.dead && !d.invOpen && !d.modalOpen) {
    const q = manequimPerto();
    if (q) {
      const r = vestir(q.nome);
      spawnDungeonToast(r ? "Agora: " + r : "De volta à heroína", d.px, d.py - 46, "#9fe3ff", 12);
      GL3.heroKey = "";
      return;
    }
  }
  /* v6.4 — E no acampamento durante o tutorial e o cochilo */
  if (d.active && d.camp && !d.dead && !d.invOpen && !d.modalOpen) {
    const n = campNear();
    if (CT.unlit && n === "fire") {
      ctFireOpen();
      return;
    }
    if (n === "hunter" && !CT.on && atenderChamado()) return; // v7.7 — campanha: o Caçador chamou (❗)
    if (econ.hunterNap && (n === "anvil" || n === "tools")) {
      spawnDungeonToast("🤫 Shhh… o Caçador tem sono leve. Nada de martelar agora.", d.px, d.py - 46, "#ffe08a", 12);
      return;
    }
    if (econ.hunterNap && n === "hunter") {
      spawnDungeonToast("💤 Zzz…", CPS.hunter!.x, CPS.hunter!.y - 40, "#cfe8ff", 14);
      return;
    }
    if (CT.on && n === "hunter") {
      spawnDungeonToast(
        "“" +
          (CT.stage === "fire" ? "A fogueira, por favor." : CT.stage === "cook" ? "Cuidado para não queimar." : "…") +
          "”",
        CPS.hunter!.x,
        CPS.hunter!.y - 40,
        "#ffe08a",
        12,
      );
      return;
    }
  }
  /* v6.3 — item no chão perto vem antes das estações do acampamento */
  {
    const tronco = interagirTroncoProximo();
    if (tronco) {
      spawnDungeonToast(
        tronco.quantidade ? "+" + tronco.quantidade + " madeiras" : "Toco limpo",
        tronco.x,
        tronco.z - 24,
        "#d19a59",
        13,
      );
      return;
    }
  }
  {
    const l = eLootFirst();
    if (l) {
      collectLoot(l);
      return;
    }
  }
  /* v6.1 — conversar com o Caçador */
  if (d.active && d.camp && !d.modalOpen && campNear() === "hunter") {
    const tip = HUNTER_TIPS[(econ.hunterTip = (econ.hunterTip! | 0) + 1) % HUNTER_TIPS.length];
    campTalk(tip);
    return;
  }
  /* v6.0 — E finaliza */
  if (d.active && !d.camp && !d.dead && !d.invOpen && !d.modalOpen && !d.finish) {
    /* v7.7 — lança arremessada cravada perto: arrancar vem antes de finalizar (senão não havia como arrancar
       de um bicho caído) */
    const s = spearStuckNear();
    if (s) {
      spearPull(s);
      return;
    }
    const m = finishTarget();
    if (m) {
      finishStart(m);
      return;
    }
  }
  /* v5.9.15 — maleta de ferramentas (carpintaria) e mesa de análise */
  if (d.active && d.camp && !d.dead && !d.invOpen && !d.modalOpen) {
    const n = campNear();
    if (interagirCercado()) return; // v7.7 — campanha: porteira, ou o menu do lobo (afagar, comida, coleira, soltar)
    if (n === "tools") {
      d.modalOpen = true;
      d._campUi = "carp";
      carpOpen(d.hero!);
      return;
    }
    if (n === "mesa") {
      d.modalOpen = true;
      d._campUi = "ana";
      anaOpen(d.hero);
      return;
    }
    /* v7.7 — baú (abre ao lado da mochila) e tenda (preparo da expedição) */
    if (n === "bau") {
      abrirBauCampo();
      return;
    }
    if (n === "tenda") {
      openPrep(d.hero!.id);
      return;
    }
  }
  /* v5.9.04 — tamanduá: painel no acampamento, alforje na masmorra */
  // v7.7: item no chão perto vem antes do tamanduá; o alcance é até o corpo dele (mountNear)
  if (
    d.active &&
    !d.dead &&
    !d.invOpen &&
    !d.modalOpen &&
    d.mount &&
    !d.mount.mounted &&
    mountNear() &&
    !nearestLoot()
  ) {
    if (d.camp) {
      mountPanel();
      return;
    }
    toggleInv(true);
    return;
  }
  /* v5.9.02 — fogueira montada na masmorra */
  if (d.active && !d.dead && !d.invOpen && !d.modalOpen && !d.camp && dfireNear()) {
    CAMP.noWood = true;
    campOpen();
    return;
  }
  /* v5.9.01 — lança cravada ou no chão */
  if (d.active && !d.dead && !d.invOpen && !d.modalOpen && !d.craftOpen) {
    const s = spearStuckNear();
    if (s) {
      spearPull(s);
      return;
    }
    const g = spearGroundNear();
    if (g) {
      const e = ensureEquip(d.hero!);
      if (!e.maoD) {
        e.maoD = g.it;
        GL3.heroKey = "";
      } else if (!placeIn(ensureInv(d.hero!), g.it)) {
        spawnDungeonToast("Mochila cheia!", d.px, d.py - 28, "#ff9a9a");
        return;
      }
      d.spears!.splice(d.spears!.indexOf(g), 1);
      spawnDungeonToast("+🔱 " + (e.maoD === g.it ? "na mão" : "na mochila"), d.px, d.py - 30, "#ffe08a");
      sfx("ping");
      return;
    }
  }
  /* v5.9 — fogueira e bigorna do acampamento */
  if (d.active && d.camp && !d.dead && !d.invOpen && !d.modalOpen) {
    const n = campNear();
    if (n === "fire") {
      campOpen();
      return;
    }
    if (n === "anvil") {
      campForge();
      return;
    }
  }
  if (!d.active || d.dead || d.invOpen || d.craftOpen || d.modalOpen) return;
  const l = nearestLoot();
  if (l) {
    collectLoot(l);
    return;
  }
  {
    const _rn = runeNearDungeon();
    if (_rn) {
      runeAbsorbOpen({ hero: d.hero!, rune: _rn, where: "dungeon" });
      return;
    }
  }
  if (inExitZone()) {
    if (armasExitCheck()) return;
    bankLoot();
    exitDungeon();
    return;
  }
  spawnDungeonToast("Nada para interagir aqui", d.px, d.py - 28, "#c9b88a");
}
export function drawSafeZone() {
  const c = TELAS.dCtx,
    T = dungeon.tile,
    e = dungeon.entrance,
    R = T * 1.4,
    inside = dSafe(),
    now = performance.now();
  const g = c.createRadialGradient(e.x, e.y, 0, e.x, e.y, R);
  g.addColorStop(0, "rgba(125,255,154,.24)");
  g.addColorStop(1, "rgba(125,255,154,.05)");
  c.save();
  c.fillStyle = g;
  c.beginPath();
  c.arc(e.x, e.y, R, 0, 7);
  c.fill();
  c.strokeStyle = "#7dff9a";
  c.lineWidth = inside ? 3 : 2;
  c.setLineDash([6, 5]);
  c.lineDashOffset = -now / 80;
  c.beginPath();
  c.arc(e.x, e.y, R + (inside ? Math.sin(now / 200) * 2 : 0), 0, 7);
  c.stroke();
  c.restore();
  c.fillStyle = "#7dff9a";
  c.font = "bold 10px Lora, serif";
  c.textAlign = "center";
  if (OPT.textos)
    c.fillText(inside ? "🛡 ZONA SEGURA — os lobos não te veem" : "SAÍDA · ZONA SEGURA", e.x, e.y + R + 12);
  else {
    c.font = "14px sans-serif";
    if (!icoCanvas(c, inside ? "fx_zona_segura" : "ui_saida", e.x, e.y + R + 12, 24))
      c.fillText(inside ? "🛡️" : "🚪", e.x, e.y + R + 16);
  }
}
export function drawDungeonLoot(dt: number) {
  const d = dungeon,
    c = TELAS.dCtx,
    near = d.dead || finPrompt() ? null : nearestLoot(),
    now = performance.now();
  d.near = near;
  for (let i = d.loot!.length - 1; i >= 0; i--) {
    const l = d.loot![i];
    if (l.ttl) {
      l.t += dt;
      if (l.t >= l.ttl) {
        addRing(l.x, l.y, "#a3443f", 18, 0.3, 2);
        d.loot!.splice(i, 1);
        continue;
      }
    } // carne apodrece
    if (D3.gl) continue; // v7.7: no 3D o item é o próprio modelo (render/gl/chao.ts) — sem ícone flutuante nem anel
    const _vis = lootVis(l);
    if (_vis <= 0 && d.near !== l) continue;
    let alpha = _vis;
    if (l.ttl && l.ttl - l.t < 8) alpha = Math.sin(now / (45 + (l.ttl - l.t) * 30)) > 0 ? 1 : 0.15; // pisca cada vez mais rápido
    const def = lootInfo(l);
    c.save();
    c.globalAlpha = alpha;
    if (D3.gl) {
      const tc = l.tier ? TIERS[l.tier].col : null,
        ic = () => {
          c.save();
          c.globalAlpha = alpha;
          c.fillStyle = "rgba(20,14,6,.6)";
          c.beginPath();
          c.arc(l.x, l.y - 7, 10.5, 0, 7);
          c.fill();
          c.strokeStyle = tc || (near === l ? "#ffe08a" : "rgba(255,240,200,.5)");
          c.lineWidth = tc ? 1.6 : 1;
          c.stroke();
          c.fillStyle = "#fff";
          icoDraw(c, icoLootDef(l, def), l.x, l.y - 7, 17, "11px serif");
          if (tc) {
            c.fillStyle = tc;
            c.font = "900 7px Cinzel, serif";
            c.strokeStyle = "#000";
            c.lineWidth = 2;
            c.strokeText(TIERS[l.tier!].lab, l.x + 8, l.y - 13);
            c.fillText(TIERS[l.tier!].lab, l.x + 8, l.y - 13);
          }
          c.restore();
        };
      d3Bill(l.x, l.y, 0, ic);
    } else if (l.ground) {
      c.globalAlpha = alpha * 0.3;
      c.fillStyle = "#000";
      c.beginPath();
      c.ellipse(l.x, l.y + 6, 8, 3, 0, 0, 7);
      c.fill();
      c.globalAlpha = alpha;
      c.font = "17px serif";
      c.textAlign = "center";
      c.fillText(def.emoji, l.x, l.y + 6);
    } else {
      const tc = l.tier ? TIERS[l.tier].col : null;
      if (tc) {
        c.shadowColor = tc;
        c.shadowBlur = 10;
      }
      c.fillStyle = def.color!;
      c.strokeStyle = tc || "#1c140b";
      c.lineWidth = tc ? 2 : 1.5;
      c.beginPath();
      c.roundRect(l.x - 9, l.y - 9, 18, 18, 4);
      c.fill();
      c.stroke();
      c.shadowBlur = 0;
      c.font = "12px serif";
      c.textAlign = "center";
      c.fillText(def.emoji, l.x, l.y + 4);
      if (tc) {
        c.fillStyle = tc;
        c.font = "900 8px Cinzel, serif";
        c.strokeStyle = "#000";
        c.lineWidth = 2;
        c.strokeText(TIERS[l.tier!].lab, l.x + 9, l.y - 9);
        c.fillText(TIERS[l.tier!].lab, l.x + 9, l.y - 9);
      }
    }
    c.restore();
    if (near === l) {
      c.beginPath();
      c.strokeStyle = "#ffe08a";
      c.lineWidth = 2;
      c.arc(l.x, l.y, 15 + Math.sin(now / 160) * 1.5, 0, 7);
      c.stroke();
    }
  }
  desenharAcoes(); // v7.7: o que dá para fazer vai para o painel no canto (ui/acoes.ts), não mais acima do herói
}
export function drawBirds(dt: number) {
  const c = TELAS.dCtx,
    now = performance.now(),
    T = dungeon.tile;
  for (const b of dungeon.birds!) {
    if (!b.alive) continue;
    if (birdFly(b, dt)) continue;
    b.t -= dt;
    if (b.t <= 0) {
      b.t = 1.5 + Math.random() * 3.5;
      b.st = Math.random() < 0.35 ? "idle" : "hop";
      b.tx = Math.max(1.5 * T, Math.min((dungeon.cols - 1.5) * T, b.x + (Math.random() - 0.5) * 140));
      b.ty = Math.max(1.5 * T, Math.min((dungeon.rows - 1.5) * T, b.y + (Math.random() - 0.5) * 100));
    }
    if (b.st === "hop") {
      const dx = b.tx - b.x,
        dy = b.ty - b.y,
        dist = Math.hypot(dx, dy);
      if (dist > 2) {
        const st = Math.min(34 * dt, dist);
        b.x += (dx / dist) * st;
        b.y += (dy / dist) * st;
      }
    }
    const bob = Math.sin(now / (b.st === "hop" ? 90 : 320) + b.vr) * (b.st === "hop" ? 2.2 : 0.8);
    const _dr = () => {
      c.save();
      c.globalAlpha = 0.25;
      c.fillStyle = "#000";
      c.beginPath();
      c.ellipse(b.x, b.y + 9, 6, 2.2, 0, 0, 7);
      c.fill();
      c.restore();
      c.font = "17px serif";
      c.textAlign = "center";
      c.fillText("🐦", b.x, b.y + 1 + bob);
    };
    if (D3.gl) {
      // o WebGL desenha por conta própria
    } else if (D3.on) D3.q.push({ y: b.y, f: () => d3Bill(b.x, b.y, 8, _dr) });
    else _dr();
  }
}
export function killBird(b: AveCampo, marked: boolean) {
  // pássaro: neutro, só cai com flecha (marcado = acerto garantido; sem marca = 15% de sorte)
  const d = dungeon;
  b.alive = false;
  if (d.target === b) d.target = null;
  const nf = 1 + (Math.random() < 0.4 ? 1 : 0);
  for (let i = 0; i < nf; i++)
    d.loot!.push({
      key: "pena",
      ground: true,
      t: 0,
      ttl: 0,
      x: b.x + (Math.random() - 0.5) * 20,
      y: b.y + (Math.random() - 0.5) * 20,
    });
  spawnDungeonToast(marked ? "Acertou! (marcado)" : "Sorte! Acertou", b.x, b.y - 18, marked ? "#ffe08a" : "#9fe3ff");
  gainSkill(d.hero!, "arco", 2);
  addBowPts(marked ? 2 : 1);
  xpBurst(b.x, b.y, "#9fe3ff", 6);
  sfx("arrowhit");
  d.birdQ!.push(25 + Math.random() * 15);
}
export function drawCone(c: CanvasRenderingContext2D, m: Monster, p: number) {
  const T = dungeon.tile;
  c.save();
  if (m.atk === "pounce") {
    if (!m.locked) {
      // carregando: só um anel pulsando no lobo — a área NÃO aparece ainda
      const pc = clamp(1 - (m.t - POUNCE_LOCK) / Math.max(0.1, (m.wuTot || 0.85) - POUNCE_LOCK), 0, 1);
      c.beginPath();
      c.arc(m.x, m.y, 9 + 12 * pc, 0, 7);
      c.strokeStyle = "rgba(255,170,80," + (0.25 + 0.5 * pc) + ")";
      c.lineWidth = 2;
      c.stroke();
    } else {
      // carga completa: a linha do salto e a marca de pouso aparecem agora
      const pl = clamp(1 - m.t / POUNCE_LOCK, 0, 1),
        len = m.l0 || T * 2,
        w = T * 1.0;
      c.translate(m.x, m.y);
      c.rotate(m.ang || 0);
      c.fillStyle = "rgba(255,150,60," + (0.14 + 0.3 * pl) + ")";
      c.fillRect(0, -w / 2, len * pl, w);
      c.setLineDash([6, 4]);
      c.strokeStyle = "rgba(255,150,70,0.95)";
      c.lineWidth = 1.6;
      c.strokeRect(0, -w / 2, len, w);
      c.restore();
      c.save();
      c.beginPath();
      c.arc(m.lx!, m.ly!, T * 0.85, 0, 7);
      c.fillStyle = "rgba(255,80,60," + (0.1 + 0.3 * pl) + ")";
      c.fill();
      c.setLineDash([5, 4]);
      c.strokeStyle = "rgba(255,90,70,0.95)";
      c.lineWidth = 1.6;
      c.stroke();
    }
  } else {
    // mordida
    const R = T * (m.boss ? 1.25 : 0.95),
      half = 0.7,
      a0 = (m.ang || 0) - half,
      a1 = (m.ang || 0) + half;
    c.beginPath();
    c.moveTo(m.x, m.y);
    c.arc(m.x, m.y, Math.max(2, R * p), a0, a1);
    c.closePath();
    c.fillStyle = "rgba(255,60,60," + (0.14 + 0.3 * p) + ")";
    c.fill();
    c.beginPath();
    c.moveTo(m.x, m.y);
    c.arc(m.x, m.y, R, a0, a1);
    c.closePath();
    c.setLineDash([5, 4]);
    c.strokeStyle = "rgba(255,90,90,0.9)";
    c.lineWidth = 1.6;
    c.stroke();
  }
  c.restore();
}
export function drawDungeonMonster(this: unknown, m: Monster) {
  // v8.1 — humano caído: a barra de vida e o anel de fôlego vão para o meio do corpo deitado (não ficam nos pés)
  if (m && m.humano && m.ko! > 0 && m.corpoCaido) {
    const x = m.x,
      y = m.y,
      cc = centroCorpo(m);
    m.x = cc.x;
    m.y = cc.y;
    try {
      return drawDungeonMonsterBase3.apply(this, arguments as Repasse);
    } finally {
      m.x = x;
      m.y = y;
    }
  }
  /* v7.0 — no 3D o retrato pintado sai; fica só a barrinha de vida e o 💫 */
  if (!m || !m.critter || !D3.gl) return drawDungeonMonsterBase3.apply(this, arguments as Repasse);
  if (!m.alive) return;
  const c = TELAS.dCtx,
    top = m.sp === "rabbit" ? 16 : m.sp === "fox" ? 20 : m.sex === "M" ? 44 : 36;
  const draw = () => {
    const bw = 22;
    if (m.hp < m.hpMax) {
      c.fillStyle = "rgba(0,0,0,.55)";
      c.fillRect(m.x - bw / 2, m.y - top, bw, 3);
      c.fillStyle = "#e05a5a";
      c.fillRect(m.x - bw / 2, m.y - top, bw * Math.max(0, m.hp / m.hpMax), 3);
    }
    /* v7.7 — fôlego em círculo, só no bicho marcado/preso (folAnel) */
    if (folAnelVisivel(m)) folAnel(c, m, m.x + bw / 2 + folAnelRaio(m) + 4, m.y - top + 1);
    // v8.0: o 💫 do caído saiu; as estrelas são peças da cena (render/gl/status_fx.ts)
  };
  d3Bill(m.x, m.y, 0, draw);
}
// etapa de drawDungeonMonster: v6.8
function drawDungeonMonsterBase3(this: unknown, m: Monster) {
  /* v6.8 */
  if (!m || !m.critter) return drawDungeonMonsterBase2.apply(this, arguments as Repasse);
  if (!m.alive) return;
  const S = CRIT_SP[m.sp!],
    c = TELAS.dCtx,
    t = performance.now() / 1000;
  const hop = m.moving ? Math.abs(Math.sin(t * (m.sp === "rabbit" ? 14 : 8) + m.x)) * (m.sp === "rabbit" ? 4 : 2) : 0,
    flip = Math.cos(m.ang!) < 0;
  const draw = () => {
    c.save();
    c.globalAlpha = 0.28;
    c.fillStyle = "#000";
    c.beginPath();
    c.ellipse(m.x, m.y + S.sz * 0.3, S.sz * 0.3, S.sz * 0.1, 0, 0, 6.283);
    c.fill();
    c.restore();
    c.save();
    if (m.flash! > 0) c.filter = "brightness(2)";
    if (flip) {
      c.translate(m.x, 0);
      c.scale(-1, 1);
      c.translate(-m.x, 0);
    }
    if (!drawSprite(m.sp!, m.sex!, 0, m.x, m.y - S.sz * 0.12 - hop, S.sz, m.ko! > 0 ? 0.7 : 1, null, c)) {
      c.fillStyle = m.sp === "rabbit" ? "#b8a088" : m.sp === "fox" ? "#d2692a" : "#9a6a3a";
      c.beginPath();
      c.arc(m.x, m.y - 6 - hop, S.sz * 0.3, 0, 6.283);
      c.fill();
    }
    c.restore();
    if (m.hp < m.hpMax) {
      const bw = 22;
      c.fillStyle = "rgba(0,0,0,.55)";
      c.fillRect(m.x - bw / 2, m.y - S.sz - 4, bw, 3);
      c.fillStyle = "#e05a5a";
      c.fillRect(m.x - bw / 2, m.y - S.sz - 4, bw * Math.max(0, m.hp / m.hpMax), 3);
    }
    if (m.ko! > 0) {
      c.font = "12px serif";
      c.textAlign = "center";
      c.fillText("💫", m.x, m.y - S.sz - 8);
    }
  };
  if (D3.gl) d3Bill(m.x, m.y, 0, draw);
  else draw();
}
// etapa de drawDungeonMonster: original + v6.2
function drawDungeonMonsterBase2(m: Monster) {
  drawDungeonMonsterBase(m);
  /* v6.2 — ---------- desenho: fôlego, flechas cravadas, arma cravada ---------- */
  try {
    if (!m.alive || !folOn(m)) return;
    const c = TELAS.dCtx,
      bw = m.boss ? 64 : 28,
      by = (D3.gl ? m.y - (m.boss ? 38 : 22) : m.y - (m.boss ? 58 : 32) / 2 - 7) + (m.boss ? 8 : 6);
    /* v7.7 — a barrinha de fôlego virou o círculo (folAnel), só no bicho marcado/preso */
    if (folAnelVisivel(m)) folAnel(c, m, m.x + bw / 2 + folAnelRaio(m) + 4, by + 1);
    if (m.stk)
      for (const s of m.stk) {
        const a = (m.ang || 0) + s.a + Math.PI,
          x0 = m.x + Math.cos(a) * 5,
          y0 = m.y - 6 + Math.sin(a) * 3;
        c.save();
        c.strokeStyle = s.k === "flecha" ? "#8a5a2b" : "#b8a070";
        c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(x0, y0);
        c.lineTo(x0 + Math.cos(a) * 11, y0 + Math.sin(a) * 11 - 4);
        c.stroke();
        c.fillStyle = "#f0e6d0";
        c.fillRect(x0 + Math.cos(a) * 11 - 1.5, y0 + Math.sin(a) * 11 - 5.5, 3, 3);
        c.restore();
      }
  } catch (_) {}
}
function drawDungeonMonsterBase(m: Monster) {
  const c = TELAS.dCtx,
    sz = m.boss ? 58 : 32,
    lift =
      m.st === "leap" ? Math.sin((m.lp || 0) * Math.PI) * 20 : m.hop! > 0 ? Math.sin((m.hop! / 0.3) * Math.PI) * 7 : 0,
    shk = m.st === "windup" && m.atk === "pounce" ? (Math.random() - 0.5) * 1.8 : 0,
    hk = m.hitT! > 0 ? m.hitT! : 0,
    hox = hk ? Math.cos(m.hitAng || 0) * hk * 28 + (Math.random() - 0.5) * hk * 14 : 0,
    hoy = hk ? Math.sin(m.hitAng || 0) * hk * 28 + (Math.random() - 0.5) * hk * 14 : 0;
  if (!D3.gl) {
    c.save();
    c.globalAlpha = 0.3;
    c.fillStyle = "#000";
    c.beginPath();
    c.ellipse(m.x, m.y + sz * 0.38, sz * 0.38, sz * 0.13, 0, 0, 7);
    c.fill();
    c.restore();
    if (
      !drawSprite(
        "wolf",
        "M",
        m.coat || 0,
        m.x + shk + hox,
        m.y - lift + hoy,
        sz * (1 + lift / 90 + hk * 0.9),
        1,
        null,
        c,
      )
    ) {
      c.beginPath();
      c.fillStyle = "#c1585b";
      c.arc(m.x, m.y, m.boss ? 18 : 11, 0, 7);
      c.fill();
      c.strokeStyle = "#1c140b";
      c.lineWidth = 1.5;
      c.stroke();
    }
    if (m.flash! > 0.04) {
      c.save();
      c.globalAlpha = 0.8;
      c.fillStyle = "#fff";
      c.beginPath();
      c.arc(m.x + hox, m.y - lift + hoy, sz * 0.46, 0, 7);
      c.fill();
      c.restore();
    } else if (hk > 0) {
      c.save();
      c.globalAlpha = Math.min(0.5, hk * 3);
      c.fillStyle = "#ff2a2a";
      c.beginPath();
      c.arc(m.x + hox, m.y - lift + hoy, sz * 0.46, 0, 7);
      c.fill();
      c.restore();
    }
  }
  if (m.dummy) return;
  const bw = m.boss ? 64 : 28,
    by = D3.gl ? m.y - (m.boss ? 38 : 22) - lift * 0.6 : m.y - sz / 2 - 7;
  c.fillStyle = "rgba(0,0,0,0.55)";
  c.fillRect(m.x - bw / 2, by, bw, m.boss ? 7 : 5);
  if (m.trail == null || m.trail < m.hp) m.trail = m.hp;
  m.trail += (m.hp - m.trail) * 0.07; // rastro branco da vida perdida
  c.fillStyle = "#fff3d0";
  c.fillRect(m.x - bw / 2, by, bw * Math.max(0, m.trail / m.hpMax), m.boss ? 7 : 5);
  c.fillStyle = m.boss ? "#ff5a5a" : "#e05a5a";
  c.fillRect(m.x - bw / 2, by, bw * Math.max(0, m.hp / m.hpMax), m.boss ? 7 : 5);
  if (m.boss) {
    c.fillStyle = "#ffe08a";
    c.font = "bold 11px Lora, serif";
    c.textAlign = "center";
    c.fillText("👑 Lobo Alfa", m.x, by - 4);
  }
}
export function drawBanner() {
  const b = dungeon.banner;
  if (!b) return;
  const c = TELAS.dCtx,
    _scr = D3.on && D3.inFrame,
    W = _scr ? D3.cw : dungeon.cols * dungeon.tile,
    a = clamp(Math.min(b.t / 0.6, (b.max - b.t) / 0.2), 0, 1);
  c.save();
  if (_scr) c.setTransform(D3.dpr, 0, 0, D3.dpr, 0, 0);
  c.globalAlpha = a;
  c.textAlign = "center";
  c.lineJoin = "round";
  c.font = "bold 28px Cinzel, serif";
  c.lineWidth = 6;
  c.strokeStyle = "rgba(0,0,0,.8)";
  c.strokeText(b.text, W / 2, 62);
  c.fillStyle = b.col;
  c.fillText(b.text, W / 2, 62);
  c.font = "bold 13px Lora, serif";
  c.lineWidth = 4;
  c.strokeText(b.sub, W / 2, 84);
  c.fillStyle = "#fff8e3";
  c.fillText(b.sub, W / 2, 84);
  c.restore();
}
/* v7.7 — foco: o jogador marca com o clique esquerdo num bicho. Clicar de novo no mesmo não tira (com arma corpo a
   corpo o clique também é o golpe, e o foco não pode ficar piscando); Esc tira. Sem alvo prioritário vivo, o foco
   também vira o alvo. O alvo prioritário em si é automático: o último bicho que você feriu ou que te atacou. */
export function marcarFoco(m: Monster) {
  const d = dungeon;
  if (!m.alive) return;
  d.foco = m;
  if (!(d.target && d.target.alive)) d.target = m;
}
export function limparFoco() {
  dungeon.foco = null;
  if (dungeon.alvoAutomatico && dungeon.hv?.kind === "clubL") dungeon.hv = null;
  dungeon.alvoAutomatico = null;
}
