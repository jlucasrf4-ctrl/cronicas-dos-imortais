import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.econ.introDone=true; __t.econ.campTut=3; __h.state='field'; __h.x+=0; __t.CAMPO_VIDA.loboChance=1;"); pg.wait_for_timeout(500)
    J("__t.jogoEnter()"); pg.wait_for_timeout(5000)
    print("mode", J("__t.dungeon.mode"), "monsters", J("__t.dungeon.monsters.map(m=>m.critter?m.sp:(m.neutral?'lobo-neutro':'lobo'))"), "birds", J("__t.dungeon.birds.length"))
    pg.wait_for_timeout(3000); pg.screenshot(path="c68_a.png")
    # move player near a rabbit -> it flees
    r=J("(()=>{const d=__t.dungeon, m=d.monsters.find(x=>x.critter&&x.sp==='rabbit'); d.px=m.x-40; d.py=m.y; window.__r=m; return [Math.round(m.x),Math.round(m.y)]})()"); pg.wait_for_timeout(1200)
    print("rabbit fled from", r, "to", J("[Math.round(__r.x),Math.round(__r.y), __r.st]"))
    # shoot/kill rabbit via hurt
    n0=J("__t.dungeon.loot.length"); J("__t.hurtMonster(__r, 99, 'arco', 1)"); pg.wait_for_timeout(300); print("rabbit loot", J("__t.dungeon.loot.slice(%d).map(l=>l.key+':'+(l.an||''))" % n0), "alive", J("__r.alive"))
    # approach wolf
    J("const d=__t.dungeon, w=d.monsters.find(x=>x.neutral); window.__w=w; d.px=w.x-60; d.py=w.y;"); pg.wait_for_timeout(800)
    print("wolf after approach", J("[__w.neutral, !!__w.fugir, __w.st, __w.alive]"))
    pg.screenshot(path="c68_b.png"); print(errs[:4]); b.close()
