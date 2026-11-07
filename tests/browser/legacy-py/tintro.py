import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
import time
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e))); pg.on("console", lambda m: errs.append("C:"+m.text) if m.type=="error" else None)
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.econ.introDone=false; __t.introStart(__h)"); pg.wait_for_timeout(1500)
    pg.screenshot(path="i1_cine.png"); print("ph", J("__t.ISC.ph"), J("__t.dungeon.mode"))
    pg.wait_for_timeout(3000); print("ph", J("__t.ISC.ph"))
    pg.keyboard.down("KeyD"); pg.wait_for_timeout(1500); pg.keyboard.up("KeyD"); pg.wait_for_timeout(1500)
    print("ph", J("__t.ISC.ph"), "boar", J("!!__t.ISC.boar"), J("[__t.ISC.t,__t.ISC.on,__t.dungeon.mode,__t.dungeon.active,__t.ISC.last,performance.now()]"), errs[:3])
    pg.screenshot(path="i2_boar.png")
    J("__t.econ.quiver.n=0")
    for i in range(60):
        pg.wait_for_timeout(700)
        if i==10: print("gotHit", J("__t.ISC.gotHit"), "down", J("__t.dungeon.down"), "dazed", J("__t.dungeon.dazed")); pg.screenshot(path="i2b_hit.png")
        if J("__t.ISC.ph") not in ("boar","explore"): break
    print("ph", J("__t.ISC.ph"), "hp", J("Math.round(__t.dungeon.hp)+'/'+__t.dungeon.hpMax"))
    pg.wait_for_timeout(250); pg.screenshot(path="i3_rescue.png"); pg.wait_for_timeout(2500); pg.screenshot(path="i4_hunter.png")
    for i in range(20):
        if J("__t.ISC.ph")=="talk": break
        pg.wait_for_timeout(500)
    print("ph", J("__t.ISC.ph"), "dlg", J("!!__t.ISC.dlg"))
    for i in range(10):
        if not J("!!__t.ISC.dlg"): break
        J("__t.dlgAdvance(); __t.dlgAdvance()"); pg.wait_for_timeout(200)
    print("ph", J("__t.ISC.ph"), "erva", J("__t.ISC.herb0"))
    pg.keyboard.press("KeyH"); pg.wait_for_timeout(2500)
    for i in range(10):
        if not J("!!__t.ISC.dlg"): break
        J("__t.dlgAdvance(); __t.dlgAdvance()"); pg.wait_for_timeout(200)
    print("ph after herb", J("__t.ISC.ph"))
    J("for(let i=0;i<2;i++) __t.tryAddItem(__t.dungeon.hero,'galho'); __t.resAdd(__t.dungeon.hero,'stone',2); __t.resAdd(__t.dungeon.hero,'feather',1)"); pg.wait_for_timeout(800)
    for i in range(6):
        if not J("!!__t.ISC.dlg"): break
        J("__t.dlgAdvance(); __t.dlgAdvance()"); pg.wait_for_timeout(200)
    print("ph", J("__t.ISC.ph"), "craft open", J("!!document.querySelector('#isc-craft.on')"))
    q0=J("__t.econ.quiver.n")
    for k in range(3): pg.click("#isc-craft [data-ic='%d']"%k); pg.wait_for_timeout(150)
    print("arrows", q0, "->", J("__t.econ.quiver.n")); pg.screenshot(path="i5_craft.png")
    pg.click("#isc-craft [data-ic='ok']"); pg.wait_for_timeout(300)
    for i in range(60):
        if J("!!__t.ISC.dlg"): J("__t.dlgAdvance(); __t.dlgAdvance()"); pg.wait_for_timeout(250)
        elif J("!!document.querySelector('#isc-ana.on')"): break
        else: pg.wait_for_timeout(500)
        if J("__t.ISC.gemShow && !(__t.ISC.npc && __t.ISC.npc.carry)") and not globals().get("gs"): globals()["gs"]=1; pg.screenshot(path="i6_gem.png")
    print("ana open", J("!!document.querySelector('#isc-ana.on')"), "knife", J("__t.ensureEquip(__t.dungeon.hero).maoD && __t.ensureEquip(__t.dungeon.hero).maoD.def.key"), "camp", J("__t.econ.hunterCamp"))
    for k in range(6): pg.click("#isc-ana [data-ia='look']"); pg.wait_for_timeout(120)
    pg.screenshot(path="i7_ana.png"); pg.click("#isc-ana [data-ia='learn']"); pg.wait_for_timeout(300)
    print("learned", J("__t.forgeKnows('eq_faca')"))
    for i in range(6):
        if not J("!!__t.ISC.dlg"): break
        J("__t.dlgAdvance(); __t.dlgAdvance()"); pg.wait_for_timeout(200)
    print("done", J("__t.econ.introDone"), J("__t.dungeon.flow"), "paused", J("__t.dungeon.modalOpen"))
    pg.screenshot(path="i8_end.png")
    print(errs[:5]); b.close()
