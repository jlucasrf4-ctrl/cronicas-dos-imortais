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
    J(pg,"__t.INTRO.i=10; __t.INTRO.phase='text'; document.getElementById('intro').click()"); pg.wait_for_timeout(2000)
    shots=[]
    for T in (2.5,5.5,9.0,11.6,12.6,18.8):
        J(pg,f"__t.INTRO.t0 = performance.now() - {T}*1000"); pg.wait_for_timeout(150); f=f"cine2_{T}.png"; pg.screenshot(path=f); shots.append(f)
        print(T, "t real:", J(pg,"((performance.now()-__t.INTRO.t0)/1000).toFixed(2)"), J(pg,"__t.INTRO.open"))
    ims=[Image.open(s).resize((640,360)) for s in shots]; sh=Image.new("RGB",(1280,360*3))
    for i,im in enumerate(ims): sh.paste(im,((i%2)*640,(i//2)*360))
    sh.save("cine_sheet2.png"); print(errs[:4]); b.close()
