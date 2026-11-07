import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":860})
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(2000)
    J(pg,"""(()=>{__t.econ.test=true; const h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.launchDungeon(h.id)})()""")
    pg.wait_for_timeout(2600)
    J(pg,"""(()=>{const d=__t.dungeon; d.monsters.length=0; d.flow='boss'; d.wave=3; const m=__t.spawnDungeonMonster({boss:true}); __t.hurtMonster(m, 9999, 'espada', 0)})()""")
    pg.wait_for_timeout(3000)
    print(J(pg,"[document.getElementById('exp-modal').style.display, __t.dungeon.modalOpen, __t.dungeon.flow, __t.dungeon.mode, document.getElementById('dungeon-wave-label').textContent, __t.dungeon.banner&&__t.dungeon.banner.text]"))
    pg.screenshot(path="loot_banner.png")
    J(pg,"__t.dungeon.flowT=10.2"); pg.wait_for_timeout(600)
    print(J(pg,"[__t.dungeon.banner&&__t.dungeon.banner.text, document.getElementById('dungeon-wave-label').textContent]"))
    J(pg,"__t.dungeon.flowT=0.1"); pg.wait_for_timeout(2500)
    print(J(pg,"[__t.dungeon.mode, __t.dungeon.flow, __t.dungeon.banner&&__t.dungeon.banner.text, __t.dungeon.monsters.filter(m=>m.alive).length]"))
    print(errs[:3]); b.close()
