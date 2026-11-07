import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}, device_scale_factor=2); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(4500)
    for k,key in enumerate(["eq_lanca","eq_espada"]):
        J("""(k=>{const d=__t.dungeon,T=d.tile; d.monsters.length=0; d.crav=null; d.px=d.cols*T/2; d.py=d.rows*T/2; const e=__t.ensureEquip(__h); const it=__t.mkItem(k); __t.eqDurInit(it); e.maoD=it;
           window.__w=__t.critSpawn('deer'); __w.sex='M'; __w.x=d.px+70; __w.y=d.py; __w.hp=__w.hpMax=200; d.gstam=100; __t.CRIT_SP.deer.scare=0; __t.cravStart(__w,k); __t.CRAV2.foge=0;})('%s')"""%key)
        box=J("(()=>{const r=document.getElementById('dungeon-canvas').getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]})()")
        pg.wait_for_timeout(600); pg.screenshot(path="t75b_%d0.png"%k, clip={"x":box[0]-140,"y":box[1]-110,"width":300,"height":200})
        pg.mouse.move(box[0]+250,box[1]); pg.mouse.down(); pg.wait_for_timeout(900)
        pg.screenshot(path="t75b_%d1.png"%k, clip={"x":box[0]-140,"y":box[1]-110,"width":300,"height":200}); pg.mouse.up(); pg.wait_for_timeout(200)
        J("__t.cravRip && __t.cravRip()"); pg.wait_for_timeout(300)
    print("errs", errs[:3]); b.close()
