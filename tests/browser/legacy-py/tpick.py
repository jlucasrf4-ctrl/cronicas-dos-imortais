import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.econ.introDone=true; __t.econ.campTut=3; __t.openPrep(__h.id)"); pg.wait_for_timeout(600); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(5000)
    for k in range(4):
        J("const d=__t.dungeon; d.loot.push({key:'pedra',x:d.px+5,y:d.py,ground:true,t:0,ttl:0}); d.toasts.length=0; __t.collectLoot(d.loot[d.loot.length-1])"); pg.wait_for_timeout(200)
        print(J("__t.dungeon.toasts.map(t=>t.text+(t.icon?'(icon)':''))"))
    print(J("JSON.stringify(['pedra','pena','penaag','erva','galho','folhama'].map(k=>[k, JSON.stringify(__t.tierShape(k,0))]))"))
    b.close()
