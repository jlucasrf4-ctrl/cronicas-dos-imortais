import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[4]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
import sys, json, collections
from playwright.sync_api import sync_playwright
mode = sys.argv[1] if len(sys.argv)>1 else "dungeon"; f = sys.argv[2] if len(sys.argv)>2 else "vtest.html"
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate
    pg.goto(BUILD_URL + ""+f); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(1500)
    if mode=="dungeon":
        J("__t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
        J("(()=>{const d=__t.dungeon; d.invuln=999; for(let i=0;i<6;i++){const m=__t.spawnDungeonMonster(); } })()"); pg.wait_for_timeout(1000)
    elif mode=="map3":
        J("document.querySelector('[data-hs=\"8\"]') && document.querySelector('[data-hs=\"8\"]').click()")
    cdp=pg.context.new_cdp_session(pg)
    cdp.send("Profiler.enable"); cdp.send("Profiler.setSamplingInterval",{"interval":200}); cdp.send("Profiler.start")
    fps=J("new Promise(r=>{let n=0;const t0=performance.now();function f(){n++; if(performance.now()-t0<5000) requestAnimationFrame(f); else r(n/5)} requestAnimationFrame(f)})")
    prof=cdp.send("Profiler.stop")["profile"]
    nodes={n["id"]:n for n in prof["nodes"]}; self=collections.Counter()
    dt=prof["timeDeltas"]; samples=prof["samples"]
    for s,d in zip(samples,dt): n=nodes[s]; cf=n["callFrame"]; self[(cf["functionName"] or "(anon)")+":"+str(cf["lineNumber"])]+=d
    tot=sum(self.values())
    print(mode,"fps",fps, "heapMB", round(J("performance.memory?performance.memory.usedJSHeapSize/1e6:0"),1))
    for k,v in self.most_common(28): print(f"{v/tot*100:5.1f}%  {k}")
    print("dom nodes", J("document.getElementsByTagName('*').length"))
    b.close()
