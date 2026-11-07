import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(800)
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    J("const d=__t.dungeon; d.flow='x'; d.monsters.length=0; __t.spawnDungeonMonster({}); window.__res={stuck:0,crit:0,n:0}")
    for i in range(40):
        J("const d=__t.dungeon, m=d.monsters[0]; m.alive=true; m.hp=9999; m.x=300; m.y=270; m.st='stalk'; m.spd=0; m.kx=0; m.ky=0; d.spears=[]; const e=__t.ensureEquip(d.hero); const it=__t.mkItem('eq_lanca'); __t.eqDurInit(it); e.maoD=it; d.px=200; d.py=270; d.cd=0; d.mouse={x:300,y:270}; __t.spearThrow(1)")
        pg.wait_for_timeout(450)
        J("const d=__t.dungeon; __res.n++; if (d.spears.some(s=>s.stuck)) __res.stuck++;")
    print(J("JSON.stringify(__res)"), errs[:3]); b.close()
