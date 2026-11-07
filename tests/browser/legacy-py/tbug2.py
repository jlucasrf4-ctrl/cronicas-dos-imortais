import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(800)
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    J("(()=>{const inv=__t.ensureInv(__t.dungeon.hero); for(const k of ['eq_lanca','eq_machado']){const it=__t.mkItem(k); __t.placeIn(inv,it);} __t.toggleInv(); })()"); pg.wait_for_timeout(800)
    print("mochila", J("__t.ensureInv(__t.dungeon.hero).items.map(i=>i.def.key+'@'+i.x+','+i.y).join(' ')"))
    cell=pg.locator("#inv-grid .inv-item .inv-cell").first; bb=cell.bounding_box()
    pg.mouse.click(bb['x']+5,bb['y']+5, button="right"); pg.wait_for_timeout(500)
    print("after right-click", J("__t.ensureInv(__t.dungeon.hero).items.map(i=>i.def.key).join(' ')"), "loot", J("__t.dungeon.loot.filter(l=>l.key.startsWith('eq_')).map(l=>l.key).join(' ')"))
    # drag second to ground grid
    cell=pg.locator("#inv-grid .inv-item .inv-cell").first; bb=cell.bounding_box(); gg=pg.locator("#inv-ground").bounding_box() if pg.locator("#inv-ground").count() else None
    print("ground grid", gg)
    if gg:
        pg.mouse.move(bb['x']+5,bb['y']+5); pg.mouse.down(); pg.mouse.move(gg['x']+60,gg['y']+30, steps=8); pg.wait_for_timeout(200); pg.mouse.up(); pg.wait_for_timeout(400)
        print("after drag", J("__t.ensureInv(__t.dungeon.hero).items.map(i=>i.def.key).join(' ')"), "loot", J("__t.dungeon.loot.filter(l=>l.key.startsWith('eq_')).map(l=>l.key).join(' ')"))
    pg.screenshot(path="s_drop.png"); print(errs[:4]); b.close()
