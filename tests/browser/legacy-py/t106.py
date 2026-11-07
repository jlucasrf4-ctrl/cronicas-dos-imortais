import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame();"); pg.wait_for_timeout(800)
    print(J("(()=>{const a=__t.world.animals.find(a=>a.species==='fox')||__t.world.animals[0]; __t.selectAnimal? __t.selectAnimal(a):0; return a.species})()"))
    print(errs[:3]); b.close()
