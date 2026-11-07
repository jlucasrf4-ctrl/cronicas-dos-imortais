// Robô que joga "como um jogador": combate simples, coleta, runas, extração.
window.BOT = { kills: 0, deaths: 0, exps: 0, runes: 0, mapRunes: 0, phase: "map", log: [], absorbing: false, expStart: 0, lootT: 0 };
(function () {
  const T_ = window.__t, B = window.BOT;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function absorbAuto(h, r, where, noise) {
    B.absorbing = true; T_.runeAbsorbOpen({ hero: h, rune: r, where });
    const RA = T_.RA; if (!RA.open) { B.absorbing = false; return; }
    const P = T_.runePattern(r.seed), jit = () => (Math.random() - 0.5) * noise * 2;
    T_.raAct("start"); RA.holding = true;
    setTimeout(() => { RA.holding = false; RA.sketch = P.map(s => s.map(p => [p[0] + jit(), p[1] + jit()])); T_.raAct("skdone");
      setTimeout(() => { const subs = T_.runeSubsOf(h), ks = Object.keys(subs).sort((a, b) => ({ gema: 4, ametista: 3.2, runa_bruta: 3.2, quartzo: 3, prata: 2.5, lingote: 2.2, ferro: 2, pedra: 1 }[b] || 0) - ({ gema: 4, ametista: 3.2, runa_bruta: 3.2, quartzo: 3, prata: 2.5, lingote: 2.2, ferro: 2, pedra: 1 }[a] || 0)); RA.sel = ks.slice(0, 2); T_.raAct("seal");
        setTimeout(() => { RA.trace = P.map(s => s.map(p => [p[0] + jit(), p[1] + jit()])); T_.raAct("tracedone");
          setTimeout(() => { const res = RA.res; B.log.push("runa(" + where + "): " + (res && res.key ? res.key : "falhou") + " s=" + (res ? res.s.toFixed(2) : "?")); if (res && res.tier) { B.runes++; if (where === "mapa") B.mapRunes++; } T_.raAct("take"); B.absorbing = false; }, 3000);
        }, 400);
      }, 400);
    }, 1700);
  }
  B.absorbAuto = absorbAuto;
  setInterval(() => { // IA de combate da masmorra
    const d = T_.dungeon; if (!d.active || d.dead || B.absorbing || d.invOpen || d.modalOpen) return;
    const h = d.hero, T = d.tile, me = { x: d.px, y: d.py };
    for (const m of d.monsters) if (!m.alive && !m._bk) { m._bk = 1; B.kills++; }
    if (d.hp < d.hpMax * 0.45 && !(d.hotLeft > 0)) T_.healHerb();
    const alive = d.monsters.filter(m => m.alive);
    let tgt = null, bd = 1e9; for (const m of alive) { const dd = dist(m, me); if (dd < bd) { bd = dd; tgt = m; } }
    const avoid = (vx, vy) => { for (const r of d.runes || []) { const dd = Math.hypot(d.px - r.x, d.py - r.y); if (dd < r.R + 22) { vx += (d.px - r.x) / dd * 1.2; vy += (d.py - r.y) / dd * 1.2; } } const n = Math.hypot(vx, vy) || 1; return { x: vx / n, y: vy / n }; };
    if (tgt) {
      const threat = alive.find(m => m.st === "windup" && dist(m, me) < T * 1.9);
      const hasShield = !h.equip || h.equip.maoE;
      if (threat && hasShield && d.gstam > 8) { d.guard = true; d.joy = null; d.mouse = { x: threat.x, y: threat.y }; return; }
      d.guard = false;
      if (bd > T * 0.8) { const v = avoid((tgt.x - d.px) / bd, (tgt.y - d.py) / bd); d.joy = { x: v.x, y: v.y, run: bd > T * 4 && d.gstam > 30 }; d.mouse = { x: tgt.x, y: tgt.y }; }
      else { d.joy = null; d.mouse = { x: tgt.x, y: tgt.y }; d.target = tgt; T_.dungeonAttack(); }
      return;
    }
    d.guard = false;
    // sem inimigos: runa → loot → (completo) saída
    const subs = Object.keys(T_.runeSubsOf(h)).length;
    if ((d.runes || []).length && T_.runeCount(h, "folhama") >= 2 && subs && d.flow !== "wave") {
      const r = d.runes[0], dd = Math.hypot(d.px - r.x, d.py - r.y);
      if (dd > r.R + 22) { const v = avoid((r.x - d.px) / dd, (r.y - d.py) / dd); d.joy = { x: v.x, y: v.y }; return; }
      d.joy = null; absorbAuto(h, r, "dungeon", 0.05); return;
    }
    const L = d.loot.filter(l => !l._skip); let ln = null; bd = 1e9; for (const l of L) { const dd = dist(l, me); if (dd < bd) { bd = dd; ln = l; } }
    if (ln && (d.flow !== "complete" || d.flowT > 12)) {
      if (bd > 18) { const v = avoid((ln.x - d.px) / bd, (ln.y - d.py) / bd); d.joy = { x: v.x, y: v.y, run: bd > T * 3 }; return; }
      d.joy = null; const n0 = d.loot.length; T_.collectLoot(ln); if (d.loot.length === n0) ln._skip = 1; return;
    }
    if (d.flow === "complete" || d.flow === "survival") {
      const e = d.entrance, dd = Math.hypot(d.px - e.x, d.py - e.y);
      if (dd > T * 0.8) { const v = avoid((e.x - d.px) / dd, (e.y - d.py) / dd); d.joy = { x: v.x, y: v.y, run: true }; return; }
      d.joy = null; T_.bankLoot(); B.exps++; B.log.push("expedição " + B.exps + " concluída, kills " + B.kills); T_.exitDungeon(); return;
    }
    d.joy = null;
  }, 60);
})();
