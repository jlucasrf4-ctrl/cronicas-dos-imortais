import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
from PIL import Image
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":720})
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(2500)
    pg.mouse.click(600,400); pg.wait_for_timeout(500)
    J(pg,"document.querySelector('[data-act=new]').click()"); pg.wait_for_timeout(1000)
    pg.screenshot(path="slide1.png")
    J(pg,"__t.INTRO.i=3; __t.INTRO.phase='text'; document.getElementById('intro').click()"); pg.wait_for_timeout(2200); pg.screenshot(path="slide5.png")
    J(pg,"__t.INTRO.i=10; document.getElementById('intro').click()"); pg.wait_for_timeout(1500)
    shots=[]
    for T in (8.0,9.4,10.45,10.9,12.35,18.9):
        J(pg,f"__t.INTRO.fz={T}"); pg.wait_for_timeout(900); f=f"cine3_{T}.png"; pg.screenshot(path=f); shots.append(f)
    ims=[Image.open(s).resize((640,360)) for s in shots]; sh=Image.new("RGB",(1280,360*3))
    for i,im in enumerate(ims): sh.paste(im,((i%2)*640,(i//2)*360))
    sh.save("cine_sheet3.png"); J(pg,"__t.INTRO.fz=null"); print(errs[:4]); b.close()
