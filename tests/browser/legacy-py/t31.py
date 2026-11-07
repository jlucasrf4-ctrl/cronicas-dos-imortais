import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
from PIL import Image
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":720})
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e))); pg.on("console",lambda m: errs.append(m.text) if m.type in ("error","warning") and "ERR_TUNNEL" not in m.text and "GL Driver" not in m.text and "swiftshader" not in m.text.lower() else None)
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(2500)
    pg.mouse.click(600,400); pg.wait_for_timeout(800)
    J(pg,"document.querySelector('[data-act=new]').click()"); pg.wait_for_timeout(2600); pg.screenshot(path="in1.png")
    for i in range(4): J(pg,"__t.INTRO.open && document.getElementById('intro').click()"); pg.wait_for_timeout(300)
    pg.wait_for_timeout(1500); pg.screenshot(path="in5.png")
    J(pg,"document.getElementById('intro').click()"); pg.wait_for_timeout(2500)
    print("fase:", J(pg,"__t.INTRO.phase"))
    shots=[]
    for T in (3.0,6.9,8.6,10.1,11.0,12.4,14.5,19.0):
        J(pg,f"__t.INTRO.t0 = performance.now() - {T}*1000"); pg.wait_for_timeout(450); f=f"cine_{T}.png"; pg.screenshot(path=f); shots.append(f)
    ims=[Image.open(s).resize((640,360)) for s in shots]; sh=Image.new("RGB",(1280,360*4))
    for i,im in enumerate(ims): sh.paste(im,((i%2)*640,(i//2)*360))
    sh.save("cine_sheet.png")
    J(pg,"__t.INTRO.t0 = performance.now() - 21.6*1000"); pg.wait_for_timeout(1500)
    print("intro aberto:", J(pg,"__t.INTRO.open"), "criar aberto:", J(pg,"document.getElementById('create-modal').classList.contains('open')"), "pausado:", J(pg,"__t.world.paused"), "heróis:", J(pg,"__t.world.heroes.length"))
    pg.screenshot(path="after_intro.png")
    print(errs[:6]); b.close()
