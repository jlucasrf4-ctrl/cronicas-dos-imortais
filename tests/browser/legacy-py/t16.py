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
    J(pg,"""(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.px=441; d.py=290; d.mouseC=null; d.mouse={x:441+100,y:290+60};})()""")
    pg.wait_for_timeout(800)
    box=pg.locator("#dungeon-canvas").bounding_box()
    hx,hy=J(pg,"(()=>{const D=__t.D3; return [D.cw/2+(__t.dungeon.px-D.cx)*D.s, D.ch/2+(__t.dungeon.py-D.cz)*D.SIN*D.s]})()")
    clip={"x":box['x']+hx-90,"y":box['y']+hy-95,"width":180,"height":140}
    shots=[]
    for st in range(3):
        for t in (0.0,0.06,0.12,0.2):
            J(pg,f"(()=>{{const d=__t.dungeon; __t.GL3.fz={t}; if(!__t.GL3.atk||__t.GL3.atk.step!=={st}){{d.cd=0; d.combo={st}; d.comboT=0.5; d.px=441; d.py=290; d.slash=null; __t.GL3.atk=null; __t.swingBasic(); d.px=441; d.py=290;}} if(d.slash) d.slash.life=0.2}})()")
            pg.wait_for_timeout(250); f=f"c{st}_{t}.png"; pg.screenshot(path=f,clip=clip); shots.append(f)
        J(pg,"__t.GL3.fz=null"); pg.wait_for_timeout(500)
    ims=[Image.open(s) for s in shots]; W,H=180,140; sheet=Image.new("RGB",(W*4,H*3),"white")
    for i,im in enumerate(ims): sheet.paste(im,((i%4)*W,(i//4)*H))
    sheet.save("combo_sheet.png"); print(errs[:3]); b.close()
