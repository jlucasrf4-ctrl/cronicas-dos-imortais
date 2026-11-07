import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
import json, collections
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.econ.introDone=true; __t.econ.campTut=3; __h.state='field'; __t.CAMPO_VIDA.loboChance=0;"); pg.wait_for_timeout(500)
    J("__t.jogoEnter()"); pg.wait_for_timeout(5000)
    J("""(()=>{const d=__t.dungeon,T=d.tile; d.px=d.cols*T/2; d.py=d.rows*T/2; for(const m of d.monsters) if(m.critter){ m.x=d.px+1.5*T*Math.cos(m.x); m.y=d.py+1.5*T*Math.sin(m.y);} })()""")
    cdp=pg.context.new_cdp_session(pg); cdp.send("Profiler.enable"); cdp.send("Profiler.setSamplingInterval",{"interval":200}); cdp.send("Profiler.start")
    pg.wait_for_timeout(4000)
    prof=cdp.send("Profiler.stop")["profile"]
    nodes={n["id"]:n for n in prof["nodes"]}; self_t=collections.Counter()
    dt=prof["timeDeltas"]; 
    for s,d in zip(prof["samples"],dt): self_t[s]+=d
    agg=collections.Counter()
    for nid,t in self_t.items(): cf=nodes[nid]["callFrame"]; agg[(cf["functionName"] or "(anon)")+":"+str(cf["lineNumber"])]+=t
    tot=sum(agg.values())
    for k,v in agg.most_common(25): print(round(v/1000), "ms", round(100*v/tot,1),"%", k)
    b.close()
