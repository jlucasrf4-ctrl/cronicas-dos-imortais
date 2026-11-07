import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(9000); print('mons', J("__t.dungeon.monsters.length"), J("__t.dungeon.active"))
    print(J("(()=>{const d=__t.dungeon; const m={x:d.px+30,y:d.py,kind:'javalino',alive:false}; d.monsters.push(m); __t.spawnLoot(m.x,m.y,true,false); return d.loot.filter(l=>l.key==='carne').map(l=>l.an)})()"))
    print(J("(()=>{const d=__t.dungeon; const l=d.loot.find(l=>l.key==='carne'); if(!l) return null; d.hero.inv.items.length=0; __t.collectLoot(l); const it=__t.ensureInv(d.hero).items.find(i=>i.def.key==='carne'); return it&&(__t.itName(it)+'|'+__t.icoKeyOf(it))})()"))
    pg.wait_for_timeout(1500); pg.screenshot(path="w_dg.png"); print(errs[:5]); b.close()
