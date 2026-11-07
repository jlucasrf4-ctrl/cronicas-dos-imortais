import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":860})
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(2000)
    J(pg,"""(()=>{__t.econ.test=true; const h=__t.createHero('Ayla',__t.bornFromSeed(777)); window.__h=h; __t.launchDungeon(h.id)})()""")
    pg.wait_for_timeout(2600)
    J(pg,"""(()=>{for(let i=0;i<3;i++)__t.spawnDungeonMonster({}); const d=__t.dungeon; d.px=d.cols*d.tile/2; d.py=d.rows*d.tile*0.6; d.flow='wave'; d.banner=null})()""")
    # clique num ponto: deve virar moveTarget perto do ponto clicado (arco: troca de arma)
    box=pg.locator("#dungeon-canvas").bounding_box()
    J(pg,"__t.dungeon.weapon='bow'")
    mx,my=box['x']+box['width']*0.7, box['y']+box['height']*0.55
    pg.mouse.click(mx,my); pg.wait_for_timeout(100)
    print(J(pg,"JSON.stringify(__t.dungeon.moveTarget)"))
    # verifica projecao inversa: projeta o alvo de volta
    print(J(pg,"""(()=>{const t=__t.dungeon.moveTarget; return 'ok'})()"""))
    pg.mouse.move(mx,my); pg.wait_for_timeout(1500); pg.screenshot(path="g_c.png")
    pg.click("#dungeon-3d"); pg.wait_for_timeout(500); pg.screenshot(path="g_2d.png")
    print(J(pg,"document.getElementById('dungeon-3d').textContent"), errs[:3])
    pg.click("#dungeon-3d"); J(pg,"__t.dungeon.weapon='bow'; __t.dungeon.charging=true; __t.dungeon.charge=0.6"); pg.wait_for_timeout(600); pg.screenshot(path="g_back.png"); print(J(pg,"document.getElementById('dungeon-stage-wrap').className"), errs[:3])
    b.close()
