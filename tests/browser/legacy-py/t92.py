import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.on("console",lambda m: m.type in("error","warning") and "TUNNEL" not in m.text and errs.append(m.text))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J(pg,"__t.enterGame(); __t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));")
    print("kit", J(pg,"(()=>{__t.armasKit(); return JSON.stringify([__t.econ.armasKit, __t.econ.stash.items.map(i=>i.def.key)])})()"))
    J(pg,"__t.openPrep(__h.id)"); pg.wait_for_timeout(1200)
    J(pg,"document.getElementById('prep-go').click()"); pg.wait_for_timeout(3000)
    setup="""(k)=>{const d=__t.dungeon; d.flow='x'; d.monsters.length=0; d.px=400; d.py=270; __t.ensureEquip(d.hero).maoD=__t.mkItem(k); d.weapon='melee'; d.cd=0; d.mouse={x:700,y:270}; d.mouseC=null;
      const m=__t.spawnDungeonMonster(); m.x=400+d.tile*1.7; m.y=270; m.spd=0.0001; m.hp=m.maxHp=999; m.st='idle'; return d.tile;}"""
    for k in ["eq_espada","eq_lanca","eq_clava","eq_machado"]:
        T=J(pg,f"({setup})('{k}')")
        r=J(pg,"""(()=>{const d=__t.dungeon; const m=d.monsters[0]; const h0=m.hp; d.combo=0; d.comboT=0; d.cd=0; __t.swingBasic(); return [__t.wpnKey(d.hero), JSON.stringify(__t.wpnProf(d.hero)), Math.round(h0-m.hp), +d.cd.toFixed(2), +__t.aimAngle().toFixed(2)];})()""")
        print(k, "T",T, r)
    # lança: arremesso, chão, pegar
    J(pg,f"({setup})('eq_lanca')"); J(pg,"__t.dungeon.monsters[0].x=9999")
    print("spearMode", J(pg,"__t.spearMode()"))
    J(pg,"__t.spearThrow()")
    print("after throw", J(pg,"JSON.stringify([!!__t.ensureEquip(__t.dungeon.hero).maoD, __t.dungeon.spears.length, __t.spearMode()])"))
    pg.wait_for_timeout(1500)
    print("landed", J(pg,"(()=>{const s=__t.dungeon.spears[0]; return JSON.stringify([s.fly, Math.round(s.x-400), Math.round(s.y), __t.dungeon.tile*3.3])})()"))
    J(pg,"(()=>{const d=__t.dungeon; d.combo=0; d.cd=0; __t.swingBasic();})()")
    J(pg,"(()=>{const d=__t.dungeon, s=d.spears[0]; d.px=s.x-5; d.py=s.y;})()"); pg.wait_for_timeout(300)
    print("picked", J(pg,"JSON.stringify([!!__t.ensureEquip(__t.dungeon.hero).maoD, __t.dungeon.spears.length, __t.dungeon.spearOut])"))
    # esquiva + bloqueio
    J(pg,f"({setup})('eq_lanca')")
    r=J(pg,"""(()=>{const d=__t.dungeon, m=d.monsters[0]; m.x=d.px+30; const hp=d.hp, mx=m.x, px=d.px; __t.spearDodge(); const rec=__t.wolfStrike(m,null,20,0); return JSON.stringify({dmg:hp-d.hp, wolfPush:Math.round(m.x-mx), rec});})()""")
    print("dodge-block", r); pg.wait_for_timeout(500)
    print("after dodge px", J(pg,"Math.round(__t.dungeon.px)"))
    # 3D shot com lança
    J(pg,f"({setup})('eq_lanca')"); J(pg,"__t.D3.ZM=2.4; window.dispatchEvent(new Event('resize'))"); pg.wait_for_timeout(800)
    box=pg.locator("#dungeon-canvas").bounding_box()
    J(pg,"(()=>{const d=__t.dungeon; d.combo=0; d.cd=0; __t.swingBasic();})()"); pg.wait_for_timeout(90)
    pg.screenshot(path="s_lanca.png", clip=box)
    J(pg,"__t.spearThrow()"); pg.wait_for_timeout(1300); pg.screenshot(path="s_lanca_chao.png", clip=box)
    for k in ["eq_clava","eq_machado"]:
        J(pg,f"({setup})('{k}')"); pg.wait_for_timeout(500); pg.screenshot(path=f"s_{k}.png", clip=box)
    print(errs[:6]); b.close()
