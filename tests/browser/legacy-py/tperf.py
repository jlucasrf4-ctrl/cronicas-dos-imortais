import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.econ.introDone=true; __t.econ.campTut=3; __h.state='field'; __t.CAMPO_VIDA.loboChance=0;"); pg.wait_for_timeout(500)
    J("__t.jogoEnter()"); pg.wait_for_timeout(5000)
    J("window.__ft=[]; (function f(t){ if(window.__lt) __ft.push(t-__lt); __lt=t; requestAnimationFrame(f); })(performance.now())")
    def fps(label):
        J("__ft.length=0"); pg.wait_for_timeout(2500); r=J("(()=>{const a=__ft.slice().sort((x,y)=>x-y); return [a.length, (a.reduce((s,x)=>s+x,0)/a.length).toFixed(1), a[Math.floor(a.length*0.95)].toFixed(1)]})()"); print(label, "frames", r)
    J("""(()=>{const d=__t.dungeon,T=d.tile; d.monsters=d.monsters.filter(m=>!m.critter); d.px=d.cols*T/2; d.py=d.rows*T/2; window.__c=__t.critSpawn('deer'); __c.x=d.px+6*T; __c.y=d.py; __c.sex='M';})()""")
    fps("longe")
    J("window.__trk=[]; window.__tk=setInterval(()=>__trk.push([__c.x,__c.y,__c.ang,__c._yy,__c.st]),50)")
    J("(()=>{const d=__t.dungeon,T=d.tile; d.px=__c.x-2*T; d.py=__c.y;})()")
    fps("perto (fugindo)")
    J("clearInterval(__tk)")
    tr=J("__trk"); import math
    flips=sum(1 for i in range(1,len(tr)) if abs(((tr[i][2]-tr[i-1][2]+math.pi)%(2*math.pi))-math.pi)>0.3)
    print("amostras",len(tr),"viradas bruscas de ângulo",flips, "pos final", [round(tr[-1][0]),round(tr[-1][1])], "estado", tr[-1][4], "fol", J("__c.fol"), J("__c.folMax"))
    print("errs", errs[:3]); b.close()
