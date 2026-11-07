import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
from PIL import Image
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); __t.OPT.autoRes=false; window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(800)
    J("__t.launchTraining(__h.id)"); pg.wait_for_timeout(3800)
    J("document.querySelector('[data-tr=\"min\"]').click(); __t.trainWeapon('eq_arco'); __t.D3.ZM=3; window.dispatchEvent(new Event('resize'))"); pg.wait_for_timeout(600)
    shots=[]
    J("(()=>{const d=__t.dungeon; d.mouse={x:d.px+300,y:d.py};})()"); pg.wait_for_timeout(300); pg.screenshot(path="b0.png")
    pg.keyboard.down("Space"); pg.wait_for_timeout(300); pg.screenshot(path="b1.png"); pg.wait_for_timeout(900); pg.screenshot(path="b2.png")
    pg.keyboard.up("Space"); pg.wait_for_timeout(60); pg.screenshot(path="b3.png"); pg.wait_for_timeout(250); pg.screenshot(path="b4.png")
    pg.keyboard.down("KeyD"); pg.wait_for_timeout(500); pg.screenshot(path="b5.png"); pg.keyboard.up("KeyD")
    ims=[Image.open(f"b{i}.png").crop((433,180,933,580)).resize((250,200)) for i in range(6)]
    sh=Image.new("RGB",(750,400)); [sh.paste(im,((i%3)*250,(i//3)*200)) for i,im in enumerate(ims)]; sh.save("s_bow.png")
    b.close()
