import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"])
    ctx=b.new_context(viewport={"width":844,"height":390},is_mobile=True,has_touch=True,device_scale_factor=2); pg=ctx.new_page(); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.openPrep(__h.id)"); pg.wait_for_timeout(600); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(5000)
    J("__t.dungeon.monsters.length=0")
    # flicker check
    seen=set()
    for i in range(16):
        seen.add(J("(document.getElementById('tb-atk')||{}).innerHTML+'#'+(document.getElementById('tb-swap')||{}).innerHTML")); pg.wait_for_timeout(150)
    print("atk/swap variants:", len(seen))
    J("__t.switchWeapon()"); pg.wait_for_timeout(800); seen=set()
    for i in range(16):
        seen.add(J("(document.getElementById('tb-atk')||{}).innerHTML")); pg.wait_for_timeout(150)
    print("after swap variants:", len(seen))
    J("__t.switchWeapon(); __t.switchWeapon(); __t.switchWeapon();"); pg.wait_for_timeout(300)
    z=J("(()=>{const r=document.getElementById('tj-zone').getBoundingClientRect(); return [r.left+r.width*0.45, r.top+r.height*0.5]})()")
    for dist in [10,20,35,52,80]:
        J(f"""(()=>{{const z=document.getElementById('tj-zone'); const ev=(t,x,y)=>z.dispatchEvent(new PointerEvent(t,{{pointerId:7,clientX:x,clientY:y,bubbles:true,cancelable:true,pointerType:'touch'}})); window.__ev=ev; __t.dungeon.px=__t.dungeon.cols*__t.dungeon.tile/2; __t.dungeon.gstam=100; ev('pointerdown',{z[0]},{z[1]}); ev('pointermove',{z[0]}+{dist},{z[1]});}})()""")
        x0=J("__t.dungeon.px"); pg.wait_for_timeout(1000); x1=J("__t.dungeon.px")
        lv=J("document.getElementById('tj-base').dataset.lv+'/'+document.getElementById('tj-base').dataset.lbl+'/'+__t.dungeon.running")
        if dist==35: pg.screenshot(path="m_joy.png")
        J(f"window.__ev('pointerup',{z[0]}+{dist},{z[1]})"); pg.wait_for_timeout(200)
        print(dist, "px/s", round(x1-x0,1), lv)
    print(errs[:3]); b.close()
