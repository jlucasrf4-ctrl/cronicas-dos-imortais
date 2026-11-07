import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.econ.introDone=true; __t.econ.campTut=3; __h.state='field'; __t.CAMPO_VIDA.loboChance=0; __t.econ.test=false;"); pg.wait_for_timeout(500)
    J("__t.jogoEnter()"); pg.wait_for_timeout(5000)
    J("""(()=>{const d=__t.dungeon,T=d.tile; d.monsters=d.monsters.filter(m=>!m.critter); d.px=d.cols*T/2; d.py=d.rows*T/2; d.gstam=100;
      if(!__t.ropeItem(__h)) __t.giveItem(__h,'corda',0);
      window.__c=__t.critSpawn('deer'); __c.x=d.px+3*T; __c.y=d.py; __c.sex='M'; d.target=__c; __t.CRIT_SP.deer.scare=0; d.mouse={x:__c.x,y:__c.y}; __t.ropeThrow(); })()""")
    pg.wait_for_timeout(600)
    st=lambda: J("JSON.stringify({bound:!!__c.bound, dom:__c.bound&&__c.bound.dom, esc:__c.bound&&+__c.bound.esc.toFixed(2), len:__c.bound&&Math.round(__c.bound.len), dist:Math.round(Math.hypot(__c.x-__t.dungeon.px,__c.y-__t.dungeon.py)), fol:__c.fol&&+__c.fol.toFixed(1), stam:Math.round(__t.dungeon.gstam), ko:+(__c.ko||0).toFixed(1), p:[Math.round(__t.dungeon.px),Math.round(__t.dungeon.py)]})")
    print("laçou", st())
    pg.wait_for_timeout(2500); print("2.5s sem puxar", st())
    pg.screenshot(path="t72_a.png")
    pg.keyboard.press("g"); pg.wait_for_timeout(300); print("preso", st()); pg.wait_for_timeout(3000); print("3s sem puxar", st()); pg.screenshot(path="t72_a.png")
    for i in range(10):
        pg.keyboard.press("g"); pg.wait_for_timeout(450)
        r=st(); print(" puxão",i+1, r)
        if '"dom":true' in r: break
    pg.wait_for_timeout(1000); c0=J("[__c.x,__c.y]")
    pg.keyboard.down("a"); pg.wait_for_timeout(2500); pg.keyboard.up("a")
    print("andou p/ esquerda", st(), "bicho moveu", round(J("Math.hypot(__c.x-%f,__c.y-%f)"%(c0[0],c0[1]))))
    pg.screenshot(path="t72_b.png")
    pg.keyboard.press("g"); pg.wait_for_timeout(200); x0=J("__t.dungeon.px"); pg.keyboard.down("a"); pg.wait_for_timeout(2500); pg.keyboard.up("a"); print("sem corda andou", round(x0-J("__t.dungeon.px")))
    print("finishTarget perto?", J("!!__t.finishTarget()"))
    pg.keyboard.press("g"); pg.wait_for_timeout(300); print("G solta:", st())
    print("errs", errs[:3]); b.close()
