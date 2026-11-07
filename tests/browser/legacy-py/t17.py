import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
import sys
from playwright.sync_api import sync_playwright
from PIL import Image
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":860})
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(2000)
    J(pg,"""(()=>{__t.econ.test=true; const h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.launchDungeon(h.id)})()""")
    pg.wait_for_timeout(2600)
    J(pg,"""(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.loot.length=0; d.px=441; d.py=273; d.mouseC=null; d.mouse={x:441+100,y:273+70}; __t.D3.ZM=3.2; window.dispatchEvent(new Event('resize'));})()""")
    pg.wait_for_timeout(1200)
    box=pg.locator("#dungeon-canvas").bounding_box()
    hx,hy=J(pg,"(()=>{const D=__t.D3; return [D.cw/2+(__t.dungeon.px-D.cx)*D.s, D.ch/2+(__t.dungeon.py-D.cz)*D.SIN*D.s]})()")
    W,H=300,260; clip={"x":box['x']+hx-W/2,"y":box['y']+hy-H*0.7,"width":W,"height":H}
    shots=[]
    for st in range(3):
        for t in (0.0,0.07,0.13,0.24):
            J(pg,f"(()=>{{const d=__t.dungeon; __t.GL3.fz={t}; if(!__t.GL3.atk||__t.GL3.atk.step!=={st}){{d.cd=0; d.combo={st}; d.comboT=0.5; d.slash=null; __t.GL3.atk=null; __t.swingBasic();}} d.px=441; d.py=273; if(d.slash) d.slash.life=0.2}})()")
            pg.wait_for_timeout(250); f=f"c{st}_{t}.png"; pg.screenshot(path=f,clip=clip); shots.append(f)
        J(pg,"__t.GL3.fz=null"); pg.wait_for_timeout(500)
    J(pg,"(()=>{const d=__t.dungeon; d.weapon='bow'; d.cd=0; d.px=441; d.py=273; __t.startCharge()})()")
    for c in (0.0,0.4,1.0):
        J(pg,f"__t.dungeon.charge={c}; __t.dungeon.full=0; __t.dungeon.px=441; __t.dungeon.py=273"); pg.wait_for_timeout(300); f=f"bw_{c}.png"; pg.screenshot(path=f,clip=clip); shots.append(f)
    J(pg,"__t.fireArrow()"); pg.wait_for_timeout(40); pg.screenshot(path="bw_rel.png",clip=clip); shots.append("bw_rel.png")
    ims=[Image.open(s) for s in shots]; sheet=Image.new("RGB",(W*4,H*4),"white")
    for i,im in enumerate(ims): sheet.paste(im,((i%4)*W,(i//4)*H))
    sheet=sheet.resize((W*4*3//4,H*4*3//4)); sheet.save("anim2.png"); print(errs[:3]); b.close()
