import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); __t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));")
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(1200)
    J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3000)
    J("(()=>{const d=__t.dungeon; d.flow='x'; d.monsters.length=0; d.px=400; d.py=270; d.weapon='bow'; d.mouse={x:700,y:270}; const m=__t.spawnDungeonMonster(); m.x=430; m.y=270; m.hp=999; m.st='idle'; m.spd=0.0001;})()")
    # clique direito real no canvas
    box=pg.locator("#dungeon-canvas").bounding_box()
    st0=J("__t.dungeon.gstam")
    pg.mouse.move(box['x']+box['width']*0.8, box['y']+box['height']/2); pg.mouse.click(box['x']+box['width']*0.8, box['y']+box['height']/2, button="right")
    print("roll", J("JSON.stringify([!!__t.dungeon.dodge, __t.dungeon.rollGuard, __t.dungeon.gstam])"), st0)
    print("strike", J("(()=>{const d=__t.dungeon,m=d.monsters[0],hp=d.hp; __t.wolfStrike(m,null,20,0); return JSON.stringify([hp-d.hp, d.quickShot]);})()"))
    pg.wait_for_timeout(400); print("px after", J("Math.round(__t.dungeon.px)"))
    print("quick", J("(()=>{const d=__t.dungeon; d.cd=0; __t.startCharge(); return JSON.stringify([d.charging, d.charge, d.quickShot]);})()"))
    J("(()=>{const d=__t.dungeon; d.charging=false; d.dodgeCd=0; d.rollGuard=0;})()"); pg.wait_for_timeout(100)
    print("no roll -> dmg", J("(()=>{const d=__t.dungeon,m=d.monsters[0],hp=d.hp; __t.wolfStrike(m,null,20,0); return hp-d.hp;})()"))
    J("(()=>{const d=__t.dungeon; d.dodgeCd=0; d.keys={KeyD:true}; __t.bowRoll(); d.keys={};})()"); pg.wait_for_timeout(120); pg.screenshot(path="s_roll.png", clip=box)
    pg.wait_for_timeout(500); print(errs[:4]); b.close()
