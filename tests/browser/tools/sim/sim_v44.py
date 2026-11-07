import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[4]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
import time, json
from playwright.sync_api import sync_playwright
LOG = open(BUILD_DIR + "/sim.log", "w", buffering=1)
def log(*a): LOG.write(" ".join(str(x) for x in a) + "\n")
def J(pg, c): return pg.evaluate(c)
DUR = 30 * 60
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1366, "height": 860}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    pg.add_script_tag(path=str(pathlib.Path(__file__).with_name("bot.js")))
    t0 = time.time()
    # o jogador real gastaria ~1 min em título/história/criação: contamos esse tempo
    J(pg, "__t.enterGame(); window.__h=__t.createHero('Ayla',__t.bornFromSeed(4242)); __t.world.speedMult=1")
    time.sleep(45)
    lastLog = -60; deaths = 0; wasDead = False; trips = 0; goldEarned = 0; shots = []
    while time.time() - t0 < DUR:
        el = time.time() - t0
        st = J(pg, """(()=>{const d=__t.dungeon,h=__h; return {act:d.active, dead:d.dead, st:h.state, flow:d.flow, wave:d.wave, hp:Math.round(d.active?d.hp:h.hp), hpMax:h.hpMax}})()""")
        if st["act"] and st["dead"] and not wasDead: deaths += 1; log(f"[{el/60:.1f}m] MORREU na masmorra (flow {st['flow']} horda {st['wave']})")
        wasDead = st["act"] and st["dead"]
        if el - lastLog >= 60:
            lastLog = el
            s = J(pg, """(()=>{const h=__h, inv=__t.ensureInv(h), B=BOT; const stash=__t.econ.stash.items; const val=stash.reduce((a,i)=>a+__t.itemVal(i),0);
              const sk={}; for(const k in (h.skills||{})) sk[k]=h.skills[k].level; const keys={}; for(const it of stash.concat(inv.items)) keys[it.def.key]=(keys[it.def.key]||0)+(it.n||1);
              return {day:Math.floor(__t.world.tick/1440)+1, lvl:h.lvl, xp:h.xp, need:__t.xpNeed(h.lvl), gold:__t.econ.gold, stashVal:val, kills:B.kills, exps:B.exps, runes:B.runes, mapRunes:B.mapRunes, pts:__t.treePoints(h), nodes:Object.keys(h.nodes||{}).length, skills:sk, items:keys, state:h.state, mapRunesNow:__t.runeList().length, runic:__t.world.animals.filter(a=>a.alive&&a.runic).length, lore:h.runeLore||{}}})()""")
            s["min"] = round(el / 60, 1); s["deaths"] = deaths; s["trips"] = trips
            log("STAT " + json.dumps(s, ensure_ascii=False))
            for m in J(pg, "BOT.log.splice(0)"): log(f"[{el/60:.1f}m] {m}")
        if int(el // 300) not in shots and el > 60:
            shots.append(int(el // 300)); pg.screenshot(path=f"{BUILD_DIR}/sim_{int(el//60):02d}.png")
        if st["act"]:
            time.sleep(1.5); continue
        if st["st"] != "idle":
            J(pg, "__t.world.speedMult=8"); time.sleep(1.5); continue
        J(pg, "__t.world.speedMult=1")
        # mapa: árvore, pedras, runa do mapa, venda, preparação, expedição
        J(pg, """(()=>{const h=__h; for(const n of __t.NODES){ if(__t.treePoints(h)<1) break; __t.buyNode(h,n.id);} })()""")
        insp = J(pg, """(()=>{const out=[]; const st=__t.econ.stash; for(let k=0;k<30;k++){ const s=st.items.find(i=>i.def.key==='pedra' && (i.insp||0)<(i.n||1)); if(!s) break; const r=__t.inspectStone(s,{inv:st}); if(r.indexOf('Era')>=0) out.push(r.split('!')[0]); } return out})()""")
        for m in insp: log(f"[{el/60:.1f}m] inspeção: {m}")
        r = J(pg, """(()=>{const h=__h; const b=__t.CONFIG?null:null; const L=__t.runeList(); if(!L.length) return null; const subs=Object.keys(__t.runeSubsOf(h)).length; if(__t.runeCount(h,'folhama')<2||!subs) return 'semmat'; __t.runeSend(L[0]); return h.state})()""")
        if r == "traveling":
            log(f"[{el/60:.1f}m] foi absorver runa no mapa")
            for _ in range(60):
                J(pg, "__t.world.speedMult=8"); time.sleep(1)
                if J(pg, "__h.state") == "hunting": break
            J(pg, "(()=>{const h=__h; const r=__t.runeList().find(q=>q.id===h.task.runeId); if(r) BOT.absorbAuto(h,r,'mapa',0.05)})()"); time.sleep(6)
            continue
        # vender o que está no baú (guarda equipamento, folhama, substratos e runas)
        sold = J(pg, """(()=>{const h=__h, st=__t.econ.stash, inv=__t.ensureInv(h); const keep=k=>/^eq_|^runa_|folhama|ferro|prata|quartzo|ametista|gema|runa_bruta/.test(k); let n=0, v=0;
            for(const it of st.items.slice()){ if(keep(it.def.key)) continue; if(it.def.key==='pedra'){continue;} const vv=__t.itemVal(it); if(__t.moveItem(it,st,inv)){n++; v+=vv;} }
            if(n<3 && v<30){ for(const it of inv.items.slice()) if(!keep(it.def.key)&&it.def.key!=='erva'&&it.def.key!=='pedra') __t.moveItem(it,inv,st); return 0; }
            const c=__t.CITIES.slice().sort((a,b)=>Math.hypot(a.x-h.camp.x,a.y-h.camp.y)-Math.hypot(b.x-h.camp.x,b.y-h.camp.y))[0]; const g0=__t.econ.gold; __t.startTrip(h,c,'foot'); window.__g0=g0; return n})()""")
        if sold:
            trips += 1; g0 = J(pg, "__g0"); log(f"[{el/60:.1f}m] viagem ao mercado com {sold} itens")
            for _ in range(240):
                J(pg, "__t.world.speedMult=8"); time.sleep(1)
                if J(pg, "__h.state") == "idle": break
            gain = J(pg, "__t.econ.gold") - g0; goldEarned += gain; log(f"[{el/60:.1f}m] voltou do mercado: +{gain} ouro (total {J(pg,'__t.econ.gold')})")
            continue
        # preparar e entrar
        J(pg, """(()=>{const h=__h; __t.openPrep(h.id); const e=__t.ensureInv(h).items.filter(i=>i.def.key==='erva').length; if(__t.econ.gold>=15 && e<3){ const b=document.querySelector('#prep-shop button[data-herbs="1"]'); if(b&&!b.disabled) b.click(); }
            const f=__t.runeCount(h,'folhama'); if(f<2 && __t.econ.gold>=8){ const b=document.querySelector('#prep-shop button[data-herbs="f"]'); if(b&&!b.disabled) b.click(); }
            const st=__t.econ.stash, inv=__t.ensureInv(h); for(const k of ['ametista','quartzo','gema','prata','ferro','pedra']){ const it=st.items.find(i=>i.def.key===k); if(it && Object.keys(__t.runeSubsOf(h)).length<2) __t.moveItem(it,st,inv); }
            for(const it of st.items.filter(i=>i.def.key==='folhama').slice(0,2)) __t.moveItem(it,st,inv);
            document.getElementById('prep-go').click(); })()""")
        log(f"[{el/60:.1f}m] entrou na masmorra (HP {st['hp']}/{st['hpMax']})")
        time.sleep(4)
    log("FIM erros:", errs[:5])
    pg.screenshot(path=BUILD_DIR + "/sim_end.png")
    b.close()
