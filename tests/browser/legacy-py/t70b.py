import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e))); pg.on("console", lambda m: print("C:", m.text[:200]) if m.type in ("warning","error") else None)
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.econ.introDone=true; __t.econ.campTut=3; __h.state='field'; __t.CAMPO_VIDA.loboChance=0;"); pg.wait_for_timeout(500)
    J("__t.jogoEnter()"); pg.wait_for_timeout(5000)
    J("""(()=>{const d=__t.dungeon,T=d.tile; d.monsters=d.monsters.filter(m=>!m.critter); d.px=d.cols*T/2; d.py=d.rows*T/2;
      window.__c=__t.critSpawn('deer'); __c.x=d.px+5*T; __c.y=d.py; d.target=__c;
      __t.hurtMonster(__c, 30, 'arco', 1); __t.arrowStick(__c, {vx:1,vy:0}); })()""")
    print("after arrow", J("JSON.stringify({hp:__c.hp.toFixed(1), hpMax:__c.hpMax, fol:__c.fol, folMax:__c.folMax, ko:__c.ko||0, alive:__c.alive})"))
    for i in range(14):
        pg.wait_for_timeout(1000); r=J("JSON.stringify({hp:__c.hp.toFixed(1), fol:__c.fol.toFixed(1), ko:(__c.ko||0).toFixed(1), st:__c.st, alive:__c.alive})"); print(i+1, r)
        if '"ko":"1' in r or '"alive":false' in r: break
    # coelho ainda cai com uma flechada
    print("rabbit", J("(()=>{const r=__t.critSpawn('rabbit'); __t.hurtMonster(r, 20, 'arco', 1); return r.alive})()"))
    print("errs", errs[:3]); b.close()
