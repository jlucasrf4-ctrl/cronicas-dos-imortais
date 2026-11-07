import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
PD = """(type,el,id,x,y)=>{const e=document.querySelector(el); e.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true,isPrimary:id===1}));}"""
with sync_playwright() as p:
    b=p.chromium.launch()
    for name,vw,vh in [("port",390,844),("land",844,390)]:
        ctx=b.new_context(viewport={"width":vw,"height":vh},device_scale_factor=2,is_mobile=True,has_touch=True)
        pg=ctx.new_page(); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
        pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
        pg.screenshot(path=f"m2_{name}_title.png")
        J(pg,"__t.enterGame(); __t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));"); pg.wait_for_timeout(1200)
        print(name,"mob:",J(pg,"[__t.MOB.on, document.documentElement.className]"))
        pg.screenshot(path=f"m2_{name}_map.png")
        J(pg,"document.querySelector('#mob-nav button[data-t=heroes]').click()"); pg.wait_for_timeout(400); pg.screenshot(path=f"m2_{name}_heroes.png")
        J(pg,"document.querySelector('#mob-nav button[data-t=pop]').click()"); pg.wait_for_timeout(400); pg.screenshot(path=f"m2_{name}_pop.png")
        J(pg,"document.querySelector('#mob-nav button[data-t=pop]').click()")
        s0=J(pg,"__t.camera.scale"); pd="("+PD+")"
        J(pg,pd+f"('pointerdown','#viewport',1,{vw/2-40},{vh/2})"); J(pg,pd+f"('pointerdown','#viewport',2,{vw/2+40},{vh/2})")
        for k in range(1,6): J(pg,pd+f"('pointermove','#viewport',1,{vw/2-40-k*15},{vh/2})"); J(pg,pd+f"('pointermove','#viewport',2,{vw/2+40+k*15},{vh/2})")
        J(pg,pd+f"('pointerup','#viewport',1,{vw/2-115},{vh/2})"); J(pg,pd+f"('pointerup','#viewport',2,{vw/2+115},{vh/2})")
        print(name,"pinch scale",s0,"->",J(pg,"__t.camera.scale"))
        J(pg,"__t.openPrep(__h.id)"); pg.wait_for_timeout(1000); pg.screenshot(path=f"m2_{name}_prep.png")
        J(pg,"document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
        J(pg,"(()=>{const d=__t.dungeon; d.flow='x'; d.monsters.length=0;})()"); pg.wait_for_timeout(500)
        p0=J(pg,"[__t.dungeon.px,__t.dungeon.py]")
        zr=J(pg,"(()=>{const r=document.getElementById('tj-zone').getBoundingClientRect(); return [r.left,r.top,r.width,r.height]})()")
        jx,jy=zr[0]+zr[2]*0.4, zr[1]+zr[3]*0.6
        J(pg,pd+f"('pointerdown','#tj-zone',5,{jx},{jy})"); J(pg,pd+f"('pointermove','#tj-zone',5,{jx+45},{jy})"); pg.wait_for_timeout(900)
        pg.screenshot(path=f"m2_{name}_dg.png")
        J(pg,pd+f"('pointerup','#tj-zone',5,{jx+45},{jy})")
        print(name,"joy move",p0,"->",J(pg,"[__t.dungeon.px,__t.dungeon.py, __t.dungeon.joy]"))
        J(pg,"__t.spawnDungeonMonster()"); pg.wait_for_timeout(300)
        J(pg,pd+"('pointerdown','#tb-atk',6,0,0)"); pg.wait_for_timeout(200); J(pg,pd+"('pointerup','#tb-atk',6,0,0)")
        print(name,"aim",J(pg,"[__t.aimAngle(), __t.dungeon.swing ? 'sw' : '-']"))
        J(pg,"__t.toggleInv()"); pg.wait_for_timeout(600); pg.screenshot(path=f"m2_{name}_inv.png"); J(pg,"__t.toggleInv(false)")
        print(name, errs[:5]); ctx.close()
    b.close()
