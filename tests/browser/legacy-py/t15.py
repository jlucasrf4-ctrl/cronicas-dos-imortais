import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
from PIL import Image
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":860})
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(2000)
    J(pg,"""(()=>{__t.econ.test=true; const h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.launchDungeon(h.id)})()""")
    pg.wait_for_timeout(2600)
    J(pg,"""(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.px=441; d.py=290; d.mouseC=null; d.mouse={x:441+100,y:290+40};})()""")
    pg.wait_for_timeout(800)
    box=pg.locator("#dungeon-canvas").bounding_box()
    hx,hy=J(pg,"(()=>{const D=__t.D3; return [D.cw/2+(__t.dungeon.px-D.cx)*D.s, D.ch/2+(__t.dungeon.py-D.cz)*D.SIN*D.s]})()")
    clip={"x":box['x']+hx-110,"y":box['y']+hy-110,"width":220,"height":170}
    shots=[]
    for st in range(3):
        J(pg,f"(()=>{{const d=__t.dungeon; d.cd=0; d.combo={st}; d.comboT=0.5; d.px=441; d.py=290; __t.swingBasic()}})()")
        for t in (40,110):
            pg.wait_for_timeout(t if t==40 else 70); f=f"cmb{st}_{t}.png"; pg.screenshot(path=f,clip=clip); shots.append(f)
        pg.wait_for_timeout(500)
    J(pg,"(()=>{const d=__t.dungeon; d.weapon='bow'; d.cd=0; d.px=441; d.py=290; __t.startCharge()})()")
    for c in (0.15,0.5,1.0):
        J(pg,f"__t.dungeon.charge={c}; __t.dungeon.full=0"); pg.wait_for_timeout(250); f=f"bow_{c}.png"; pg.screenshot(path=f,clip=clip); shots.append(f)
    J(pg,"__t.fireArrow()"); pg.wait_for_timeout(60); pg.screenshot(path="bow_rel.png",clip=clip); shots.append("bow_rel.png")
    ims=[Image.open(s) for s in shots]; W=220; sheet=Image.new("RGB",(W*5,170*2),"white")
    for i,im in enumerate(ims): sheet.paste(im,((i%5)*W,(i//5)*170))
    sheet.save("anim_sheet.png"); print(errs[:3]); b.close()
