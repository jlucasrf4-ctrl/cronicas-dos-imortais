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
    J(pg,"""(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.loot.length=0; d.px=441; d.py=273; d.mouseC=null; d.mouse={x:441+100,y:273+70}; __t.D3.ZM=2.6; window.dispatchEvent(new Event('resize'));})()""")
    pg.wait_for_timeout(1200)
    box=pg.locator("#dungeon-canvas").bounding_box(); W,H=360,300; clip={"x":box['x']+box['width']/2-W/2,"y":box['y']+box['height']/2-H*0.62,"width":W,"height":H}
    shots=[]
    for st in range(3):
        J(pg,f"(()=>{{const d=__t.dungeon; __t.GL3.fz=0.12; d.cd=0; d.combo={st}; d.comboT=0.5; d.slash=null; __t.GL3.atk=null; __t.swingBasic(); d.px=441; d.py=273;}})()")
        pg.wait_for_timeout(300); f=f"tr{st}.png"; pg.screenshot(path=f,clip=clip); shots.append(f)
    J(pg,"__t.GL3.fz=null")
    ims=[Image.open(s) for s in shots]; sheet=Image.new("RGB",(W*3,H),"white")
    for i,im in enumerate(ims): sheet.paste(im,(i*W,0))
    sheet.save("trails.png"); print(errs[:3]); b.close()
