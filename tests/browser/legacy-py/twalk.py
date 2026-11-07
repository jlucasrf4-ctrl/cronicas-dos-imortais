import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
from PIL import Image
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); __t.OPT.autoRes=false; window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(800)
    J("__t.launchTraining(__h.id)"); pg.wait_for_timeout(3800)
    J("document.querySelector('[data-tr=\"min\"]').click(); __t.D3.ZM=3; window.dispatchEvent(new Event('resize'))"); pg.wait_for_timeout(500)
    J("(()=>{const d=__t.dungeon; d.mouse=null;})()")
    fr=[]
    pg.keyboard.down("KeyS"); 
    for i in range(4): pg.wait_for_timeout(110); pg.screenshot(path=f"w{i}.png")
    pg.keyboard.down("ShiftLeft")
    for i in range(4,8): pg.wait_for_timeout(110); pg.screenshot(path=f"w{i}.png")
    pg.keyboard.up("ShiftLeft"); pg.keyboard.up("KeyS")
    sh=Image.new("RGB",(1000,520))
    for i in range(8):
        im=Image.open(f"w{i}.png"); W,H=im.size; sh.paste(im.crop((W//2-220,H//2-200,W//2+180,H//2+130)).resize((250,206)),((i%4)*250,(i//4)*260))
    sh.save("s_walk.png"); print(J("__t.dungeon.running"), errs[:3]); b.close()
