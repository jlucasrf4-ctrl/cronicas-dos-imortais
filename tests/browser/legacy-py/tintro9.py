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
    bb=pg.query_selector("#ich-hold").bounding_box(); pg.mouse.move(bb['x']+20,bb['y']+10); pg.mouse.down(); pg.wait_for_timeout(1000); print("mid fill", J("document.getElementById('ich-fill').style.width")); pg.wait_for_timeout(1500); pg.mouse.up(); pg.wait_for_timeout(200)
    print("arrows", q0, "->", J("__t.econ.quiver.n")); pg.screenshot(path="i5_craft.png")
    pg.click("#isc-craft [data-ic='ok']"); pg.wait_for_timeout(300)
    for i in range(60):
        if J("!!__t.ISC.dlg"): J("__t.dlgAdvance(); __t.dlgAdvance()"); pg.wait_for_timeout(250)
        elif J("!!document.querySelector('#isc-ana.on')"): break
        elif J("!!document.querySelector('.inv-ana.hot')"):
            print("inv open w/ analyze chip"); pg.screenshot(path="a1_inv.png"); print("chip box", pg.query_selector(".inv-ana.hot").bounding_box(), J("ISC_dbg=(()=>{const b=document.querySelector('.inv-ana.hot').getBoundingClientRect(); const e=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2); return e&&(e.className+'|'+e.tagName)})()")); pg.click(".inv-ana.hot", force=True); pg.wait_for_timeout(500); print("ana on after js click", J("!!document.querySelector('#isc-ana.on')"))
        else: pg.wait_for_timeout(500)
        if J("__t.ISC.gemShow && !(__t.ISC.npc && __t.ISC.npc.carry)") and not globals().get("gs"): globals()["gs"]=1; pg.screenshot(path="i6_gem.png")
    print("ana open", J("!!document.querySelector('#isc-ana.on')"), "knife", J("__t.ensureEquip(__t.dungeon.hero).maoD && __t.ensureEquip(__t.dungeon.hero).maoD.def.key"), "camp", J("__t.econ.hunterCamp"))
    for k in range(6): pg.click("#isc-ana [data-ia='look']"); pg.wait_for_timeout(120)
    pg.screenshot(path="i7_ana.png"); pg.click("#isc-ana [data-ia='learn']"); pg.wait_for_timeout(300)
    print("learned", J("__t.forgeKnows('eq_faca')"), "perc", J("__t.profLv(__t.dungeon.hero,'percepcao')"), "hud", J("getComputedStyle(document.getElementById('perc-hud')).display"))
    pg.screenshot(path="a2_hud.png")
    for i in range(6):
        if not J("!!__t.ISC.dlg"): break
        J("__t.dlgAdvance(); __t.dlgAdvance()"); pg.wait_for_timeout(200)
    print("done", J("__t.econ.introDone"), J("__t.dungeon.flow"), "paused", J("__t.dungeon.modalOpen"))
    pg.wait_for_timeout(8000); print("8s after hunter left, mode:", J("__t.dungeon.mode"), "active", J("__t.dungeon.active"))
    J("const d=__t.dungeon; d.px=d.entrance.x; d.py=d.entrance.y;"); pg.wait_for_timeout(300); print("exitzone", J("[__t.inExitZone(), __t.dungeon.modalOpen, __t.dungeon.invOpen, __t.dungeon.flow, __t.econ.introDone, __t.ISC._toMap]")); [ (pg.keyboard.press("KeyE"), pg.wait_for_timeout(300)) for _ in range(5) if not J("__t.ISC._toMap") ]; pg.wait_for_timeout(2500); print("after E", J("[__t.ISC._toMap, __t.dungeon.active, __t.dungeon.mode, __t.world.heroes[0].state, [...document.querySelectorAll(\".v3-modal.open,.mv-panel.open,#create-modal.open,#log-modal.open,#sheet-modal.open\")].map(e=>e.id)]"))
    for i in range(60):
        pg.wait_for_timeout(500)
        if J("__t.dungeon.active && __t.dungeon.mode==='campo'"): break
    pg.wait_for_timeout(1500); print("JOGO mode", J("__t.dungeon.mode"), "arrows", J("__t.econ.quiver.n"), "perc", J("[__t.profLv(__t.dungeon.hero,\"percepcao\"), getComputedStyle(document.getElementById(\"perc-hud\")).display, __t.dungeon.hero.skills.percepcao && __t.dungeon.hero.skills.percepcao.level]")); pg.screenshot(path="j1_campo.png")
    print("state", J("JSON.stringify({m:__t.dungeon.modalOpen,i:__t.dungeon.invOpen,dead:__t.dungeon.dead,isc:__t.ISC.on})"), J("(()=>{const e=document.elementFromPoint(683,430); return e&&(e.id||e.className||e.tagName)})()"))
    J("window.__wh=[]; window.addEventListener(\"wheel\", e=>window.__wh.push((e.target.id||e.target.className)+\":\"+e.deltaY), true)"); pg.mouse.move(683,430); pg.mouse.wheel(0,200); pg.wait_for_timeout(100); print("JOGO", J("[__t.JOGO.wheel, __t.JOGO.wt]"), J("!!document.getElementById('dungeon-view').contains(document.getElementById('dungeon-canvas'))"))
    for k in range(3): pg.mouse.wheel(0,120); pg.wait_for_timeout(80)
    print("after wheels", J("[__t.JOGO.wheel, __t.dungeon.active, __t.dungeon.mode, window.__wh]"))
    for i in range(20):
        pg.wait_for_timeout(300)
        if not J("__t.dungeon.active"): break
    pg.wait_for_timeout(1500)
    print("MAP active", J("__t.dungeon.active"), "hero", J("JSON.stringify({st:__t.world.heroes[0].state, d:Math.round(Math.hypot(__t.world.heroes[0].x-__t.world.heroes[0].camp.x,__t.world.heroes[0].y-__t.world.heroes[0].camp.y))})"), "campTut", J("__t.econ.campTut"), "modals", J("[...document.querySelectorAll('.v3-modal.open,.mv-panel.open')].map(e=>e.id)"))
    pg.screenshot(path="m1_map.png")
    x0=J("__t.world.heroes[0].y"); pg.keyboard.down("KeyW"); pg.wait_for_timeout(700); pg.keyboard.up("KeyW"); print("WASD moved up", round(x0-J("__t.world.heroes[0].y"),1))
    pg.wait_for_timeout(400); pg.screenshot(path="m2_bal.png"); print("bal", J("JSON.stringify(__t.MAPCTL.bal)"))
    bx=J("(()=>{const B=__t.MAPCTL.bal, vp=document.getElementById('viewport').getBoundingClientRect(); return [vp.left+B.x*__t.camera.scale+__t.camera.tx, vp.top+B.y*__t.camera.scale+__t.camera.ty]})()")
    print("bx", bx, J("(()=>{const e=document.elementFromPoint(%d,%d); return e&&(e.id||e.className||e.tagName)})()" % (bx[0],bx[1])), J("[__t.camera.scale, __t.camera.zanim, __t.MAPCTL.bal && __t.MAPCTL.bal.kind]")); pg.mouse.click(bx[0],bx[1]); pg.wait_for_timeout(300); print("after balloon", J("__t.world.heroes[0].state"), "modals", J("[...document.querySelectorAll('.v3-modal.open,.mv-panel.open')].map(e=>e.id)"))
    for i in range(40):
        pg.wait_for_timeout(500)
        if J("__t.dungeon.active && __t.dungeon.camp"): break
    pg.wait_for_timeout(2500); print("camp", J("__t.dungeon.camp"), "CT", J("JSON.stringify(__t.CT)"), "dlg", J("!!__t.ISC.dlg"))
    pg.screenshot(path="c1_arrive.png")
    for i in range(6):
        if not J("!!__t.ISC.dlg"): break
        J("__t.dlgAdvance(); __t.dlgAdvance()"); pg.wait_for_timeout(250)
    J("const d=__t.dungeon; d.px=__t.CPS.fire.x-d.tile*0.9; d.py=__t.CPS.fire.y;"); pg.wait_for_timeout(300)
    print("near", J("__t.campNear()")); pg.keyboard.press("KeyE"); pg.wait_for_timeout(500); print("fire modal", J("!!document.querySelector('#fire-modal.open')")); pg.screenshot(path="c2_fire.png")
    J("__t.fireStart('pedra')"); pg.wait_for_timeout(200)
    for i in range(30):
        if not J("!!document.querySelector('#fire-modal.open')"): break
        J("const g=__t.FIRE&&__t.FIRE.mg; if(g){g.pos=g.zc}"); pg.keyboard.press("Space"); pg.wait_for_timeout(260)
    print("lit", J("!__t.CT.unlit"))
    pg.wait_for_timeout(1500)
    for i in range(6):
        if not J("!!__t.ISC.dlg"): break
        J("__t.dlgAdvance(); __t.dlgAdvance()"); pg.wait_for_timeout(250)
    pg.wait_for_timeout(600); print("inv open", J("__t.dungeon.invOpen"), "SS meat", J("__t.ensureInv(__t.dungeon.hero).items.filter(i=>i.def.key==='carne').map(i=>i.tier+':'+i.an)"))
    pg.screenshot(path="c3_inv.png"); J("__t.toggleInv(false)"); pg.wait_for_timeout(1000)
    print("choice", J("!!document.querySelector('#isc-choice.on')")); pg.screenshot(path="c4_choice.png")
    pg.click("#isc-choice [data-ch='1']"); pg.wait_for_timeout(300)
    for i in range(6):
        if not J("!!__t.ISC.dlg"): break
        J("__t.dlgAdvance(); __t.dlgAdvance()"); pg.wait_for_timeout(250)
    print("stage", J("__t.CT.stage")); J("__t.cookFinish()"); pg.wait_for_timeout(3600)
    for i in range(8):
        if not J("!!__t.ISC.dlg"): break
        J("__t.dlgAdvance(); __t.dlgAdvance()"); pg.wait_for_timeout(250)
    print("tent", J("__t.econ.tent"), "nap", J("__t.econ.hunterNap"), "tut", J("__t.econ.campTut"))
    J("const d=__t.dungeon; d.px=__t.CPS.anvil.x-d.tile*0.5; d.py=__t.CPS.anvil.y;"); pg.wait_for_timeout(300); print("near", J("__t.campNear()")); [ (pg.keyboard.press("KeyE"), pg.wait_for_timeout(300)) for _ in range(5) if not J("__t.ISC._toMap") ]; print("forge open?", J("!!document.querySelector('#forge-modal.open, .forge-modal.open')"), J("(__t.dungeon.toasts||[]).slice(-1).map(t=>t.text)"))
    J("const d=__t.dungeon; d.px=__t.CPS.fire.x-__t.dungeon.tile*1.5; d.py=__t.CPS.fire.y+__t.dungeon.tile*1.2"); pg.wait_for_timeout(800); pg.screenshot(path="c5_nap.png")
    print(errs[:5]); b.close()
