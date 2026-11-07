import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(4500)
    print("ground kinds", J("[...new Set(__t.dungeon.loot.map(l=>l.key))]"), J("__t.dungeon.loot.length"))
    pg.screenshot(path="g63_ground.png")
    # KO by sword hits
    res=[]
    for trial in range(6):
        r=J("""(()=>{const d=__t.dungeon; d.monsters.length=0; const m=__t.trainWolf(); m.x=d.px+26; m.y=d.py; let n=0;
          while(m.alive && !(m.ko>0) && n<80){ d.cd=0; d.noAtk=0; d.crav=null; m.cravCd=99; m.x=d.px+26; m.y=d.py; d.mouse={x:m.x,y:m.y}; __t.swingBasic(); n++; }
          return JSON.stringify({ko:m.ko>0, alive:m.alive, hpPct:Math.round(m.hp/m.hpMax*100), hits:n})})()""")
        res.append(r)
    print("sword trials", res)
    r=J("""(()=>{const d=__t.dungeon; d.monsters.length=0; const m=__t.trainWolf(); m.kind='javalino'; m.hp=m.hpMax=60; delete m.folMax; m.x=d.px+26; m.y=d.py; let n=0;
          while(m.alive && !(m.ko>0) && n<200){ d.cd=0; d.noAtk=0; d.crav=null; m.cravCd=99; m.x=d.px+26; m.y=d.py; d.mouse={x:m.x,y:m.y}; __t.swingBasic(); n++; }
          return JSON.stringify({ko:m.ko>0, alive:m.alive, hpPct:Math.round(m.hp/m.hpMax*100), hits:n})})()""")
    print("javali", r)
    # give weapons and open inventory
    J("const h=__t.dungeon.hero; for (const k of ['eq_faca','eq_faca_velha','eq_machado','eq_lanca','eq_espada_longa']) __t.tryAddToInv(__t.ensureInv(h),k);")
    J("__t.toggleInv(true)"); pg.wait_for_timeout(800); pg.screenshot(path="g63_inv.png")
    print("icons", J("[...document.querySelectorAll('.wxi')].map(e=>e.className.split(' ').pop()).slice(0,12)"))
    print(errs[:4]); b.close()
