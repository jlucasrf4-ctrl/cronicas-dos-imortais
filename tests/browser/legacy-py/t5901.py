import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(800)
    print("lanca shape", J("(()=>{const it=__t.mkItem('eq_lanca'); return [it.shape.length, it.shape[0].length]})()"), "flecha", J("[__t.ITEM_DEFS.flecha.shape.length]"))
    # forge: couro
    J("__t.econ.test=true; __t.CAMP.allowForge=true; __t.openForge(); __t.CAMP.allowForge=false; __t.forgeStart('make','eq_armadura')"); pg.wait_for_timeout(600)
    print("ph", J("__t.FG.mg.ph"), J("document.getElementById('fg-mgtxt').textContent.slice(0,80)"))
    pg.screenshot(path="s_cut0.png")
    # drag knife along path
    box=pg.locator("#fg-cv").bounding_box(); pts=J("(()=>{const g=__t.FG.mg; return g.cut})()")
    L=box["width"]; H=L*0.62; ax,ay,aw,ah=L*0.14,H*0.07,L*0.72,H*0.82
    import random
    P=[(box["x"]+ax+q[0]*aw+random.uniform(-3,3), box["y"]+ay+q[1]*ah+random.uniform(-3,3)) for q in pts]
    pg.mouse.move(*P[0]); pg.mouse.down()
    for i,q in enumerate(P):
        pg.mouse.move(*q)
        if i==len(P)//2: pg.screenshot(path="s_cut1.png")
    pg.mouse.up(); pg.wait_for_timeout(300)
    print("after cut", J("JSON.stringify({ph:__t.FG.mg.ph, cut:__t.FG.mg.cutScore, hits:__t.FG.mg.hits})"))
    pg.wait_for_timeout(500); pg.screenshot(path="s_sew.png")
    for i in range(6):
        J("(()=>{const g=__t.FG.mg; g.sew.t=g.sew.dur*(1-9/34);})()"); J("__t.sewHit()")
    print("after sew", J("JSON.stringify({ph:__t.FG.mg.ph, q:__t.FG.mg.q})")); pg.screenshot(path="s_sew_done.png")
    J("document.querySelector('[data-mg=done]') && __t.forgeFinish()")
    # cota
    J("__t.forgeStart('make','eq_cota'); __t.FG.mg.T=0.7"); pg.wait_for_timeout(700)
    print("cota ph", J("__t.FG.mg.ph"))
    pg.screenshot(path="s_rings.png")
    for i in range(6): J("__t.FG.mg.T=0.7; __t.FG.mg.ring.a=-Math.PI/2+0.05; __t.ringHit()")
    print("cota after", J("__t.FG.mg.ph"))
    J("__t.forgeClose()")
    # dungeon spear
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    J("const d=__t.dungeon; d.flow='x'; d.monsters.length=0; const e=__t.ensureEquip(d.hero); const it=__t.mkItem('eq_lanca'); __t.eqDurInit(it); e.maoD=it; if(d.weapon!=='melee') __t.switchWeapon(); __t.GL3.heroKey=''; d.px=200; d.py=270;")
    J("const d=__t.dungeon; const m=__t.spawnJavalino?null:null;")
    J("const d=__t.dungeon; window.__w=__t.spawnDungeonMonster({})")
    print("wolf", J("!!__w"))
    J("const d=__t.dungeon; const m=d.monsters[0]; m.x=300; m.y=270; m.st='stalk'; m.spd=0; d.mouse={x:300,y:270}; __t.spearThrow(1)"); pg.wait_for_timeout(700)
    print("stuck", J("JSON.stringify(__t.dungeon.spears.map(s=>({fly:s.fly, stuck:!!s.stuck})))"), J("!!__t.dungeon.monsters[0].bleed"))
    pg.screenshot(path="s_stuck.png")
    J("const d=__t.dungeon, m=d.monsters[0]; d.px=m.x-40; d.py=m.y; d.cd=0; window.__hp0=m.hp; __t.swingBasic()")
    print("pull", J("JSON.stringify({dmg:Math.round(__hp0-__t.dungeon.monsters[0].hp), hand:!!__t.ensureEquip(__t.dungeon.hero).maoD, spears:__t.dungeon.spears.length})"))
    # shove levels
    for lab,t in [("perfeito",0.1),("quase",0.35),("cedo",0.8)]:
        J(f"const d=__t.dungeon, m=d.monsters[0]; d.dodgeCd=0; d.shove=0; d.gstam=100; d.px=m.x-45; d.py=m.y; d.mouse={{x:m.x,y:m.y}}; m.st='windup'; m.t={t}; m.atk='bite'; m.alive=true; m.hp=999")
        J("__t.spearShove()"); print("shove", lab, J("JSON.stringify({st:__t.dungeon.monsters[0].st, down:__t.dungeon.monsters[0].downT||0})"))
    pg.wait_for_timeout(100); pg.screenshot(path="s_shove.png")
    # thrust visual
    J("const d=__t.dungeon; d.cd=0; d.parryVis=0; d.monsters[0].x=600; d.mouse={x:600,y:270}; __t.swingBasic()"); pg.wait_for_timeout(60); pg.screenshot(path="s_thrust.png")
    # bow: right button charges
    J("const d=__t.dungeon; __t.switchWeapon(); d.cd=0")
    print("weapon", J("__t.dungeon.weapon"))
    cvb=pg.locator("#dungeon-canvas").bounding_box() if pg.locator("#dungeon-canvas").count() else None
    print("canvas", bool(cvb))
    pg.mouse.move(cvb["x"]+cvb["width"]*0.7, cvb["y"]+cvb["height"]*0.5); pg.mouse.down(button="left"); pg.wait_for_timeout(200); print("left charging", J("__t.dungeon.charging")); pg.mouse.up(button="left")
    pg.mouse.down(button="right"); pg.wait_for_timeout(600); print("right charging", J("[__t.dungeon.charging, +(__t.dungeon.charge||0).toFixed(2)]")); pg.mouse.up(button="right"); pg.wait_for_timeout(100); print("fired", J("[__t.dungeon.charging, __t.dungeon.arrows.length]"))
    print(errs[:5]); b.close()
