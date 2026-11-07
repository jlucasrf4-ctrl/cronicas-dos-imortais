import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
from PIL import Image
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); __t.OPT.autoRes=false; window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(800)
    J("__t.launchTraining(__h.id)"); pg.wait_for_timeout(3800)
    J("document.querySelector('[data-tr=\"min\"]').click(); __t.D3.ZM=3; window.dispatchEvent(new Event('resize'))"); pg.wait_for_timeout(600)
    pg.screenshot(path="c0.png")
    J("__t.trainWeapon('eq_arco')"); pg.wait_for_timeout(500); pg.screenshot(path="c1.png")
    J("__t.OPT.outline=false"); pg.wait_for_timeout(500); pg.screenshot(path="c2.png")
    J("__t.OPT.outline=true; __t.trainWeapon('eq_espada')"); pg.wait_for_timeout(500); pg.screenshot(path="c3.png")
    ims=[Image.open(f"c{i}.png").crop((433,180,933,580)).resize((250,200)) for i in range(4)]
    sh=Image.new("RGB",(1000,200)); [sh.paste(im,(i*250,0)) for i,im in enumerate(ims)]; sh.save("s_bow2.png")
    print(J("JSON.stringify(Object.keys(__t.GL3.hero))"))
    b.close()
