import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(4500)
    print("aplicar", J("JSON.stringify(__t.aplicarDano(10,[15,75,10],[4,12,4],0))"))
    print("res kit", J("__t.armorRes(__t.dungeon.hero).map(v=>v.toFixed(1))"), "red avg", J("__t.armorRed(__t.dungeon.hero).toFixed(3)"), "plate", J("__t.plateMult(__t.dungeon.hero)"))
    J("__t.DMG.att={kind:'javalino'}"); print("red vs javali", J("__t.armorRed(__t.dungeon.hero).toFixed(3)")); J("__t.DMG.att=null")
    J("const d=__t.dungeon; d.monsters.length=0; window.__m=__t.trainWolf(); __m.x=d.px+26; __m.y=d.py; d.mouse={x:__m.x,y:__m.y};")
    print("wolf", J("JSON.stringify({hp:__m.hp,dummy:!!__m.dummy,fol:__t.ensureFol(__m).fol})"))
    hp0=J("__m.hp"); J("__t.dungeon.cd=0; Math.random=(()=>{const r=Math.random; return ()=>0.99})(); __t.swingBasic()"); print("swing dmg", round(hp0-J("__m.hp"),2), "last", J("JSON.stringify(__t.DMG.last&&{b:__t.DMG.last.base.toFixed(2),t:__t.DMG.last.total.toFixed(2),k:__t.DMG.last.key})"))
    # arrows: javalino fôlego 15, 3 flechas seguidas
    J("window.__b=__t.trainWolf(); __b.kind='javalino'; __b.hp=__b.hpMax=60; __b.x=__t.dungeon.px+150; __b.y=__t.dungeon.py; delete __b.folMax; __t.ensureFol(__b);")
    J("Math.random=()=>0.01; for(let i=0;i<3;i++) __t.arrowStick(__b,{vx:1,vy:0},3);")
    print("boar fol", J("__b.folMax"), "stk", J("__b.stk.length"))
    for i in range(6):
        pg.wait_for_timeout(1000); print(" t",i+1, "fol", J("__b.fol.toFixed(1)"), "ko", J("(__b.ko||0).toFixed(1)"), "hp", J("__b.hp.toFixed(1)"))
    # cravar espada
    J("Math.random=(()=>{let s=1;return ()=>{s=(s*16807)%2147483647;return s/2147483647}})()")
    J("window.__w=__t.trainWolf(); __w.x=__t.dungeon.px+24; __w.y=__t.dungeon.py; __t.dungeon.gstam=100; __t.cravStart(__w,'eq_espada')")
    print("crav", J("!!__t.dungeon.crav"), J("__t.dungeon.crav&&__t.dungeon.crav.stored"))
    J("__t.cravPress()"); pg.wait_for_timeout(2000)
    print("after 2s push stored", J("__t.dungeon.crav&&__t.dungeon.crav.stored.toFixed(1)"), "fol", J("__w.fol.toFixed(1)"), "stam", J("Math.round(__t.dungeon.gstam)"), "wolf st", J("__w.st"))
    J("__t.cravRelease()"); print("released(no rip)", J("!!__t.dungeon.crav"))
    hp0=J("__w.hp"); J("__t.cravPress(); __t.cravRelease()"); print("rip dmg", round(hp0-J("__w.hp"),2), "crav", J("!!__t.dungeon.crav"))
    # timeout
    J("__w.cravCd=0; __w.hp=__w.hpMax; __t.cravStart(__w,'eq_espada')"); hp=J("__t.dungeon.hp"); pg.wait_for_timeout(4600)
    print("timeout crav", J("!!__t.dungeon.crav"), "noAtk", J("(__t.dungeon.noAtk||0).toFixed(2)"), "hero hp lost", hp-J("__t.dungeon.hp"))
    # lança no limite: lobo 12 fôlego
    J("window.__l=__t.trainWolf(); __l.x=__t.dungeon.px+24; __l.y=__t.dungeon.py; __t.dungeon.gstam=100; __t.dungeon.hp=__t.dungeon.hpMax; __t.cravStart(__l,'eq_lanca'); __t.cravPress()")
    for i in range(7):
        pg.wait_for_timeout(1000); J("__t.dungeon.gstam=100")
        print(" spear t",i+1,"fol",J("__l.fol.toFixed(1)"),"ko",J("(__l.ko||0).toFixed(1)"),"crav",J("!!__t.dungeon.crav"))
    J("__t.cravRelease()")
    print("tips sword", J("__t.itemStatLines(__t.ensureEquip(__t.dungeon.hero).maoD||{def:__t.ITEM_DEFS.eq_espada}).map(x=>x.join(':')).join(' | ')"))
    print("tips peito", J("__t.itemStatLines(__t.ensureEquip(__t.dungeon.hero).peito).map(x=>x.join(':')).join(' | ')"))
    print("tips elmo", J("__t.itemStatLines(__t.ensureEquip(__t.dungeon.hero).cabeca).map(x=>x.join(':')).join(' | ')"))
    s=J("__t.statsHtml(__t.dungeon.hero)"); import re; print("stats", re.sub('<[^>]+>',' ',s)[-260:])
    pg.screenshot(path="d_end.png")
    print(errs[:4]); b.close()
