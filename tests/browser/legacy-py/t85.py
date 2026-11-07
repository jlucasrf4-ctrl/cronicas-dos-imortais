import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":720}); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3000)
    J(pg,"__t.playIntro()"); pg.wait_for_timeout(800)
    J(pg,"__t.cineStart()")
    print(J(pg,"__t.INTRO.phase"))
    for T in [6.0, 8.6, 13.5]:
        J(pg,f"__t.INTRO.t0=performance.now()-{T}*1000"); pg.wait_for_timeout(250); pg.screenshot(path=f"c_{T}.png")
    print(errs[:4]); b.close()
