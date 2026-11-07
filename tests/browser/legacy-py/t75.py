import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(4500)
    J("window.__w=__t.trainWolf()")
    print("chance estocada lança", J("__t.cravChanceMelee(__w, __t.DANO.ARMAS.eq_lanca, 'eq_lanca').toFixed(2)"), "espada", J("__t.cravChanceMelee(__w, __t.DANO.ARMAS.eq_espada, 'eq_espada').toFixed(2)"))
    for ch in (0.5, 0.8, 1.0):
        print("arremesso ch",ch, J("(()=>{let n=0; for(let i=0;i<2000;i++) if(__t.spearThrowStick(__w,false,{ch:%f})) n++; return n/2000})()"%ch))
    # segurar cravado: vida cai, fôlego não
    J("""(()=>{const d=__t.dungeon,T=d.tile; d.monsters.length=0; d.px=d.cols*T/2; d.py=d.rows*T/2; const e=__t.ensureEquip(__h); const it=__t.mkItem('eq_lanca'); __t.eqDurInit(it); e.maoD=it;
       window.__w=__t.trainWolf(); __w.x=d.px+60; __w.y=d.py; __w.hp=__w.hpMax=60; d.gstam=100; __t.cravStart(__w,'eq_lanca');})()""")
    pg.wait_for_timeout(500); h0=J("[__w.hp,__w.fol]"); d0=J("Math.hypot(__w.x-__t.dungeon.px,__w.y-__t.dungeon.py)")
    box=J("(()=>{const r=document.getElementById('dungeon-canvas').getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]})()")
    pg.mouse.move(box[0]+200,box[1]); pg.mouse.down(); pg.wait_for_timeout(2000)
    print("segurou 2s: vida", round(h0[0]-J("__w.hp"),1), "perdida · fôlego antes/depois", round(h0[1],1), round(J("__w.fol"),1), "· dist", round(d0), "->", round(J("Math.hypot(__w.x-__t.dungeon.px,__w.y-__t.dungeon.py)")))
    pg.screenshot(path="t75_hold.png", clip={"x":box[0]-200,"y":box[1]-150,"width":420,"height":300}); pg.mouse.up(); pg.mouse.click(box[0],box[1],button="right"); pg.wait_for_timeout(300)
    # finalizar: bicho desmaiado perto + item no chão perto
    J("""(()=>{const d=__t.dungeon,T=d.tile; d.monsters.length=0; window.__k=__t.trainWolf(); __k.x=d.px+30; __k.y=d.py; __k.ko=10; d.loot.push({key:'pedra',ground:true,t:0,ttl:0,x:d.px-10,y:d.py+8});})()""")
    pg.wait_for_timeout(500); print("prompt:", J("__t.finPrompt()"))
    pg.screenshot(path="t75_fin.png", clip={"x":box[0]-250,"y":box[1]-200,"width":500,"height":330})
    print("errs", errs[:3]); b.close()
