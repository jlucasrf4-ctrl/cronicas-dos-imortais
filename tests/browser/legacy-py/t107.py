import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));"); pg.wait_for_timeout(800)
    J("__t.launchTraining(__h.id)"); pg.wait_for_timeout(3800)
    J("document.querySelector('[data-tr=\"min\"]').click(); __t.trainWeapon('eq_machado'); __t.trainAttr('destreza',8); __t.dungeon.combo=0; __t.D3.ZM=2.4; window.dispatchEvent(new Event('resize'))"); pg.wait_for_timeout(600)
    for i in range(6):
        J("(()=>{const d=__t.dungeon,m=d.monsters[0]; d.px=m.x-34; d.py=m.y+4; d.mouse={x:m.x+50,y:m.y}; d.cd=0; d.comboT=1; __t.swingBasic();})()"); pg.wait_for_timeout(110)
    pg.screenshot(path="s_dmg1.png")
    print(J("__t.dungeon.toasts.filter(t=>t.dmg).map(t=>t.text+(t.crit?'C':'')+(t.dot?'D':'')).join(' ')"))
    print(errs[:3]); b.close()
