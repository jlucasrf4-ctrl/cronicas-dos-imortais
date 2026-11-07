import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J(pg,"__t.enterGame(); __t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));")
    J(pg,"__t.openPrep(__h.id)"); pg.wait_for_timeout(800); pg.screenshot(path="d_prep.png")
    J(pg,"document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    r=J(pg,"""(()=>{const d=__t.dungeon; d.flow='x'; d.monsters.length=0; const r=d.runes[0]; window.__dr=r; d.px=r.x-70; d.py=r.y+10;
      const m=__t.spawnDungeonMonster(); m.x=r.x+r.R*0.3; m.y=r.y; m.alerted=false; const j=__t.spawnJavalino(2); j.x=r.x+90; j.y=r.y-40; window.__j=j;
      return [d.runes.length, r.el, d.loot.filter(l=>l.key==='folhama').length]})()""")
    print("dg:",r); pg.wait_for_timeout(1500)
    print("wolf:",J(pg,"__t.dungeon.monsters.map(m=>m.name+'|'+(m.runic||'-')+'|'+m.hpMax)"), "rune str", J(pg,"__dr.str"))
    J(pg,"(()=>{const d=__t.dungeon; for(const m of d.monsters){ m.st='wander'; m.alerted=false; m.spd=0.01; m.x=m.x; } })()")
    pg.screenshot(path="d_rune.png")
    J(pg,"(()=>{const d=__t.dungeon; d.px=__dr.x-__dr.R-12; d.py=__dr.y;})()"); pg.wait_for_timeout(400)
    print("near:",J(pg,"!!__t.runeNearDungeon()")); pg.screenshot(path="d_prompt.png")
    J(pg,"__t.dungeon.loot.length=0; __t.interact()"); pg.wait_for_timeout(500); print("modal:",J(pg,"[__t.RA.open, __t.RA.where, __t.dungeon.modalOpen]")); pg.screenshot(path="d_abs.png")
    J(pg,"document.getElementById('ra-x').click()"); pg.wait_for_timeout(300); print("closed:",J(pg,"[__t.RA.open, __t.dungeon.modalOpen]"))
    J(pg,"(()=>{const d=__t.dungeon; d.px=__dr.x; d.py=__dr.y; })()"); hp0=J(pg,"__t.dungeon.hp"); pg.wait_for_timeout(1000); print("burn hp",hp0,"->",J(pg,"[__t.dungeon.hp, Math.hypot(__t.dungeon.px-__dr.x,__t.dungeon.py-__dr.y)]"))
    print(errs[:6]); b.close()
