import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); m=b.new_page(viewport={"width":844,"height":390}, is_mobile=True, has_touch=True); J=m.evaluate; errs=[]; m.on("pageerror",lambda e:errs.append(str(e)))
    m.goto(BUILD_URL + "vtest.html"); m.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));"); m.wait_for_timeout(800); m.screenshot(path="s_i_mob0.png")
    J("__t.launchTraining(__h.id)"); m.wait_for_timeout(3800); m.screenshot(path="s_i_mob.png"); print(errs[:3]); b.close()
