import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(800)
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    J("const d=__t.dungeon; d.flow='x'; d.monsters.length=0; __t.spawnDungeonMonster({}); window.__m=d.monsters[0];")
    pos="{const d=__t.dungeon, m=__m; m.x=d.px+38; m.y=d.py; m.kx=m.ky=0; m.hp=999; d.mouse={x:m.x+10,y:m.y};}"
    J("const d=__t.dungeon; const e=__t.ensureEquip(d.hero); const it=__t.mkItem('eq_machado'); __t.eqDurInit(it); e.maoD=it; __t.GL3.heroKey=''; d.weapon='melee'; d.cd=0; d.gstam=100;"+pos+"__t.doParry()")
    pg.wait_for_timeout(700); r=J(pos+"window.__hp=__m.hp; __t.hvRelease('R'); return 0" if False else "(()=>{"+pos+"const h0=__m.hp; __t.hvRelease('R'); return JSON.stringify({dmg:Math.round(h0-__m.hp), crip:+(__m.cripple||0).toFixed(2)})})()"); print("axe", r)
    pg.wait_for_timeout(300); pg.screenshot(path="s_axe_hit.png")
    J("const d=__t.dungeon; const e=__t.ensureEquip(d.hero); const it=__t.mkItem('eq_clava'); __t.eqDurInit(it); e.maoD=it; __t.GL3.heroKey=''; d.cd=0; __m.cripple=0;")
    J("window.__hp=999;"+pos+"__t.swingBasic()")
    for i in range(14): J(pos.replace("m.hp=999; ","")); pg.wait_for_timeout(80)
    print("club combo dmg", J("Math.round(999-__m.hp)"))
    J("const d=__t.dungeon; d.cd=0;"+pos+"__t.doParry()"); [pg.wait_for_timeout(200) for _ in range(20) if not J("!!(__t.dungeon.hv && __t.dungeon.hv.full)")]; print("ch", J("JSON.stringify(__t.dungeon.hv)"))
    print("smash", J("(()=>{"+pos+"const h0=__m.hp; __t.hvRelease('R'); return JSON.stringify({st:__m.st, stun:+(__m.stun||0).toFixed(1), dmg:Math.round(h0-__m.hp)})})()"))
    print(errs[:5]); b.close()
