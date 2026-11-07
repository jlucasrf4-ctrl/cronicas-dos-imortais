import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":860})
    pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(2200)
    pg.evaluate("(()=>{__t.econ.test=true; const h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.updateHeroPanelUI(); __t.openPrep(h.id)})()"); pg.wait_for_timeout(400)
    pg.screenshot(path="prep.png")
    pg.evaluate("document.getElementById('prep-go').click()"); pg.wait_for_timeout(2400)
    # hitbox melee: lobo na borda do corpo
    r=pg.evaluate("""(()=>{const d=__t.dungeon; d.px=d.tile*12; d.py=d.tile*6; d.monsters.forEach(x=>x.alive=false); __t.spawnDungeonMonster(); const m=d.monsters.find(x=>x.alive); m.hp=m.hpMax=500; d.mouse={x:d.px+100,y:d.py}; m.x=d.px+d.tile*0.62+10; m.y=d.py; m.st='recover'; m.t=5; d.cd=0; d.guard=false; const h0=m.hp; __t.swingBasic(); return {hit:h0-m.hp>0, dist:Math.round(m.x-d.px), reach:Math.round(d.tile*0.62), body:__t.monR(m)}})()""")
    print(r)
    pg.wait_for_timeout(80); pg.screenshot(path="melee.png")
    print(errs[:5]); b.close()
