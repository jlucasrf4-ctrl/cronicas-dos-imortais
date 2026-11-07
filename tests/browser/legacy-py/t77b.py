import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
import math
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.econ.introDone=true; __t.econ.campTut=3; __h.state='field'; __t.CAMPO_VIDA.loboChance=0;"); pg.wait_for_timeout(500)
    J("__t.jogoEnter()"); pg.wait_for_timeout(5000)
    J("""(()=>{const d=__t.dungeon,T=d.tile; d.monsters=d.monsters.filter(m=>!m.critter); d.px=d.cols*T/2; d.py=d.rows*T/2; window.__c=__t.critSpawn('deer'); __c.x=d.px+3*T; __c.y=d.py; __c.sex='M';
      window.__trk=[]; window.__tk=setInterval(()=>__trk.push([__c.x,__c.y,__c.ang,__c.st, __c.fol]),40);})()""")
    # jogador vai seguindo o cervo devagar, para na borda do susto
    for i in range(12):
        J("(()=>{const d=__t.dungeon,T=d.tile; const a=Math.atan2(__c.y-d.py,__c.x-d.px); const dist=Math.hypot(__c.x-d.px,__c.y-d.py); if(dist>4.2*T){d.px+=Math.cos(a)*T*0.5; d.py+=Math.sin(a)*T*0.5;}})()"); pg.wait_for_timeout(300)
    pg.screenshot(path="t77_deer.png")
    J("clearInterval(__tk)"); tr=J("__trk")
    flips=sum(1 for i in range(1,len(tr)) if abs(((tr[i][2]-tr[i-1][2]+math.pi)%(2*math.pi))-math.pi)>0.5)
    sts=sum(1 for i in range(1,len(tr)) if tr[i][3]!=tr[i-1][3])
    print("amostras",len(tr),"viradas >0.5rad",flips,"trocas de estado",sts,"fôlego", round(tr[-1][4],1), "estados", sorted(set(t[3] for t in tr)))
    print("errs", errs[:3]); b.close()
