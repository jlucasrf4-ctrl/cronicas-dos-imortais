/* Teste de jogo com robô em tempo real: o bot.js luta, coleta e absorve runas no campo; este script cuida do
   mapa (árvore de talentos, inspecionar pedras, runas do mapa, vender no mercado, preparar e partir).
   A cada minuto grava uma linha STAT (JSON) no log; a cada 5 minutos, uma captura de tela.
   Uso: node tests/browser/tools/sim/sim.ts [minutos, padrão 7] [--ref]
   Saída: tests/browser/resultados/tools/sim.log e sim_MM.png. Substitui sim_v44.py (30 min) e sim_v45.py (7 min,
   com o desgaste do equipamento na linha STAT, que este também grava). */
import fs from "node:fs";
import path from "node:path";
import { SAIDA, abrirJogo, args } from "../abrir.ts";

const DUR = Number(args[0] ?? 7) * 60;
fs.mkdirSync(SAIDA, { recursive: true });
const LOG = fs.createWriteStream(path.join(SAIDA, "sim.log"));
const log = (...a: unknown[]) => LOG.write(a.map(String).join(" ") + "\n");
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

const s = await abrirJogo();
const erros: string[] = [];
s.page.on("pageerror", (e) => erros.push(String(e)));
await s.page.addScriptTag({ path: path.join(import.meta.dirname, "bot.js") });
const t0 = Date.now();
// o jogador real gastaria ~1 min em título, história e criação: esse tempo conta
await s.js("__t.enterGame(); window.__h=__t.createHero('Ayla',__t.bornFromSeed(4242)); __t.world.speedMult=1");
await dormir(45_000);

interface Estado {
  act: boolean;
  dead: boolean;
  st: string;
  flow: string;
  wave: number;
  hp: number;
  hpMax: number;
}
let ultimoLog = -60,
  mortes = 0,
  estavaMorto = false,
  viagens = 0;
const fotos = new Set<number>();
const min = (el: number) => `[${(el / 60).toFixed(1)}m]`;

while ((Date.now() - t0) / 1000 < DUR) {
  const el = (Date.now() - t0) / 1000;
  const st = await s.js<Estado>(
    "(()=>{const d=__t.dungeon,h=__h; return {act:d.active, dead:d.dead, st:h.state, flow:d.flow, wave:d.wave, hp:Math.round(d.active?d.hp:h.hp), hpMax:h.hpMax}})()",
  );
  if (st.act && st.dead && !estavaMorto) {
    mortes++;
    log(`${min(el)} MORREU na masmorra (flow ${st.flow} horda ${st.wave})`);
  }
  estavaMorto = st.act && st.dead;
  if (el - ultimoLog >= 60) {
    ultimoLog = el;
    const stat = await s.js<Record<string, unknown>>(
      "(()=>{const h=__h, inv=__t.ensureInv(h), B=BOT; const stash=__t.econ.stash.items; const val=stash.reduce((a,i)=>a+__t.itemVal(i),0); const sk={}; for(const k in (h.skills||{})) sk[k]=h.skills[k].level; const keys={}; for(const it of stash.concat(inv.items)) keys[it.def.key]=(keys[it.def.key]||0)+(it.n||1); return {day:Math.floor(__t.world.tick/1440)+1, lvl:h.lvl, xp:h.xp, need:__t.xpNeed(h.lvl), gold:__t.econ.gold, stashVal:val, kills:B.kills, exps:B.exps, runes:B.runes, mapRunes:B.mapRunes, pts:__t.treePoints(h), nodes:Object.keys(h.nodes||{}).length, skills:sk, items:keys, state:h.state, mapRunesNow:__t.runeList().length, runic:__t.world.animals.filter(a=>a.alive&&a.runic).length, lore:h.runeLore||{}, eq:Object.entries(__t.ensureEquip(h)).map(([k,i])=>k+':'+(i?(i.dur+'/'+i.durMax):'QUEBROU')).join(' ')}})()",
    );
    Object.assign(stat, { min: +(el / 60).toFixed(1), deaths: mortes, trips: viagens });
    log("STAT " + JSON.stringify(stat));
    for (const m of await s.js<string[]>("BOT.log.splice(0)")) log(`${min(el)} ${m}`);
  }
  const bloco = Math.floor(el / 300);
  if (el > 60 && !fotos.has(bloco)) {
    fotos.add(bloco);
    await s.page.screenshot({ path: path.join(SAIDA, `sim_${String(Math.floor(el / 60)).padStart(2, "0")}.png`) });
  }
  if (st.act) {
    await dormir(1500);
    continue;
  }
  if (st.st !== "idle") {
    await s.js("__t.world.speedMult=8");
    await dormir(1500);
    continue;
  }
  await s.js("__t.world.speedMult=1");
  // mapa: árvore, pedras, runa do mapa, venda, preparação, expedição
  await s.js("(()=>{const h=__h; for(const n of __t.NODES){ if(__t.treePoints(h)<1) break; __t.buyNode(h,n.id);} })()");
  const insp = await s.js<string[]>(
    "(()=>{const out=[]; const st=__t.econ.stash; for(let k=0;k<30;k++){ const s=st.items.find(i=>i.def.key==='pedra' && (i.insp||0)<(i.n||1)); if(!s) break; const r=__t.inspectStone(s,{inv:st}); if(r.indexOf('Era')>=0) out.push(r.split('!')[0]); } return out})()",
  );
  for (const m of insp) log(`${min(el)} inspeção: ${m}`);
  const r = await s.js<string | null>(
    "(()=>{const h=__h; const L=__t.runeList(); if(!L.length) return null; const subs=Object.keys(__t.runeSubsOf(h)).length; if(__t.runeCount(h,'folhama')<2||!subs) return 'semmat'; __t.runeSend(L[0]); return h.state})()",
  );
  if (r === "traveling") {
    log(`${min(el)} foi absorver runa no mapa`);
    for (let i = 0; i < 60; i++) {
      await s.js("__t.world.speedMult=8");
      await dormir(1000);
      if ((await s.js("__h.state")) === "hunting") break;
    }
    await s.js(
      "(()=>{const h=__h; const r=__t.runeList().find(q=>q.id===h.task.runeId); if(r) BOT.absorbAuto(h,r,'mapa',0.05)})()",
    );
    await dormir(6000);
    continue;
  }
  // vender o que está no baú (guarda equipamento, folhama, substratos e runas)
  const vendeu = await s.js<number>(
    "(()=>{const h=__h, st=__t.econ.stash, inv=__t.ensureInv(h); const keep=k=>/^eq_|^runa_|folhama|ferro|prata|quartzo|ametista|gema|runa_bruta/.test(k); let n=0, v=0; for(const it of st.items.slice()){ if(keep(it.def.key)) continue; if(it.def.key==='pedra'){continue;} const vv=__t.itemVal(it); if(__t.moveItem(it,st,inv)){n++; v+=vv;} } if(n<3 && v<30){ for(const it of inv.items.slice()) if(!keep(it.def.key)&&it.def.key!=='erva'&&it.def.key!=='pedra') __t.moveItem(it,inv,st); return 0; } const c=__t.CITIES.slice().sort((a,b)=>Math.hypot(a.x-h.camp.x,a.y-h.camp.y)-Math.hypot(b.x-h.camp.x,b.y-h.camp.y))[0]; window.__g0=__t.econ.gold; __t.startTrip(h,c,'foot'); return n})()",
  );
  if (vendeu) {
    viagens++;
    const g0 = await s.js<number>("__g0");
    log(`${min(el)} viagem ao mercado com ${vendeu} itens`);
    for (let i = 0; i < 240; i++) {
      await s.js("__t.world.speedMult=8");
      await dormir(1000);
      if ((await s.js("__h.state")) === "idle") break;
    }
    const ouro = await s.js<number>("__t.econ.gold");
    log(`${min(el)} voltou do mercado: +${ouro - g0} ouro (total ${ouro})`);
    continue;
  }
  // preparar e partir
  await s.js(
    "(()=>{const h=__h; __t.openPrep(h.id); const e=__t.ensureInv(h).items.filter(i=>i.def.key==='erva').length; if(__t.econ.gold>=15 && e<3){ const b=document.querySelector('#prep-shop button[data-herbs=\"1\"]'); if(b&&!b.disabled) b.click(); } const f=__t.runeCount(h,'folhama'); if(f<2 && __t.econ.gold>=8){ const b=document.querySelector('#prep-shop button[data-herbs=\"f\"]'); if(b&&!b.disabled) b.click(); } const st=__t.econ.stash, inv=__t.ensureInv(h); for(const k of ['ametista','quartzo','gema','prata','ferro','pedra']){ const it=st.items.find(i=>i.def.key===k); if(it && Object.keys(__t.runeSubsOf(h)).length<2) __t.moveItem(it,st,inv); } for(const it of st.items.filter(i=>i.def.key==='folhama').slice(0,2)) __t.moveItem(it,st,inv); document.getElementById('prep-go').click(); })()",
  );
  log(`${min(el)} entrou na masmorra (HP ${st.hp}/${st.hpMax})`);
  await dormir(4000);
}
log("FIM erros:", JSON.stringify(erros.slice(0, 5)));
await s.page.screenshot({ path: path.join(SAIDA, "sim_fim.png") });
LOG.end();
await s.browser.close();
console.log("log em", path.join(SAIDA, "sim.log"));
