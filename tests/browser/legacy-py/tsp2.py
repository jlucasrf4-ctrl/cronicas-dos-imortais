import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
from PIL import Image
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); __t.OPT.autoRes=false; window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(800)
    J("__t.launchTraining(__h.id)"); pg.wait_for_timeout(3800)
    J("document.querySelector('[data-tr=\"min\"]').click(); __t.D3.ZM=3; window.dispatchEvent(new Event('resize')); __t.trainWeapon('eq_arco')"); pg.wait_for_timeout(600)
    box=pg.locator("#dungeon-canvas").bounding_box(); cx=box['x']+box['width']*0.75; cy=box['y']+box['height']*0.5
    pg.mouse.move(cx,cy); pg.mouse.down(); pg.wait_for_timeout(900); print("charging", J("__t.dungeon.charging"), J("+__t.dungeon.charge.toFixed(2)")); pg.mouse.up(); pg.wait_for_timeout(100)
    print("after release charging", J("__t.dungeon.charging"), "arrows", J("__t.dungeon.arrows.length"))
    pg.keyboard.press("Space"); pg.wait_for_timeout(50); print("space roll", J("!!(__t.dungeon.dodge && __t.dungeon.dodge.roll)"))
    pg.wait_for_timeout(600)
    J("__t.trainWeapon('eq_lanca')"); pg.wait_for_timeout(600)
    J("(()=>{const d=__t.dungeon; d.mouse={x:d.px+300,y:d.py};})()"); pg.wait_for_timeout(400); pg.screenshot(path="sp0.png")
    J("(()=>{const d=__t.dungeon; d.cd=0; d.combo=0; __t.swingBasic();})()"); pg.wait_for_timeout(90); pg.screenshot(path="sp1.png")
    pg.wait_for_timeout(500); pg.mouse.move(cx,cy); pg.mouse.down(button="right"); pg.wait_for_timeout(800); pg.screenshot(path="sp2.png"); pg.mouse.up(button="right"); pg.wait_for_timeout(1500)
    J("(()=>{const d=__t.dungeon,s=d.spears[0]; if(s){d.px=s.x;d.py=s.y;}})()"); pg.wait_for_timeout(500)
    J("(()=>{const d=__t.dungeon; d.mouse={x:d.px+300,y:d.py}; d.dodgeCd=0; __t.spearDodge();})()"); pg.wait_for_timeout(60); pg.screenshot(path="sp3.png")
    ims=[]
    for i in range(4):
        im=Image.open(f"sp{i}.png"); ims.append(im)
    # crop around hero: find via canvas center? use center of screen region
    W,H=ims[0].size; sh=Image.new("RGB",(1000,260))
    for i,im in enumerate(ims): sh.paste(im.crop((W//2-200,H//2-170,W//2+150,H//2+120)).resize((250,207)),(i*250,0))
    sh.save("s_spear2h.png"); print(errs[:3]); b.close()
