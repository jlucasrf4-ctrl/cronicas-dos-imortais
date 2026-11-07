import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(800)
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    J("const d=__t.dungeon; d.flow='x'; d.monsters.length=0; const e=__t.ensureEquip(d.hero); const it=__t.mkItem('eq_clava'); __t.eqDurInit(it); e.maoD=it; __t.GL3.heroKey=''; __t.spawnJavalino(2); window.__b=d.monsters.find(m=>m.kind==='javalino');")
    pos="{const d=__t.dungeon,m=__b; m.x=d.px+36; m.y=d.py; m.kx=m.ky=0; m.hp=999; m.alive=true; d.mouse={x:m.x+10,y:m.y};}"
    # boar charging gets blocked by club smash
    J("const d=__t.dungeon; d.cd=0; __t.doParry()")
    for _ in range(25):
        if J("!!(__t.dungeon.hv&&__t.dungeon.hv.full)"): break
        pg.wait_for_timeout(150)
    print("full", J("__t.dungeon.hv&&__t.dungeon.hv.full"))
    print("block boar", J("(()=>{"+pos+"__b.st='charge'; __b.ang=Math.PI; __b.ct=0; __b.cx0=__b.x; __b.cy0=__b.y; __b.hit=false; __t.hvRelease('R'); return JSON.stringify({st:__b.st,t:+(__b.t||0).toFixed(1)})})()"))
    # tiers statistics: simulate many releases at fixed ch
    res=J("""(()=>{const d=__t.dungeon, out={}; for (const [lab,ch,full] of [['cedo',0.2,false],['medio',0.6,false],['cheio',1,true]]) { let st=0,hit=0; for (let i=0;i<200;i++){ """+pos+""" __b.st='chase'; __b.stun=0; d.cd=0; d.hv={kind:'clubR',t:1,ch,full}; const h0=__b.hp; __t.hvRelease('R'); if(__b.hp<h0) hit++; if(__b.stun>0) st++; } out[lab]=[hit,st]; } return JSON.stringify(out)})()""")
    print("tiers [hits,stuns]/200", res)
    print(errs[:5]); b.close()
