import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(800)
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    J("const d=__t.dungeon; d.flow='x'; d.monsters.length=0; const e=__t.ensureEquip(d.hero); const it=__t.mkItem('eq_lanca'); __t.eqDurInit(it); e.maoD=it; __t.GL3.heroKey=''; d.px=200; d.py=270; __t.spawnDungeonMonster({})")
    for lab,t in [("perfeito",0.1),("quase",0.35),("cedo",0.8),("sem golpe",None)]:
        st = "'stalk'" if t is None else "'windup'"
        r=J(f"(()=>{{const d=__t.dungeon, m=d.monsters[0]; d.dodgeCd=0; d.shove=0; d.gstam=100; d.px=m.x-45; d.py=m.y; d.mouse={{x:m.x,y:m.y}}; m.st={st}; m.t={t or 0}; m.atk='bite'; m.alive=true; m.hp=999; const t0=__t.dungeon.parryCd; __t.spearShove(); return JSON.stringify({{st:m.st, down:m.downT||0, stun:m.stun||0, kx:Math.round(m.kx||0), toast:(d.toasts||[]).slice(-1).map(x=>x.text)}})}})()")
        print(lab, r); pg.wait_for_timeout(400)
    pg.screenshot(path="s_shove.png")
    print(errs[:5]); b.close()
