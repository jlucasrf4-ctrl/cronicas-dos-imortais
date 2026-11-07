import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(4500)
    print("boars on map", J("__t.populationOf('boar')"), "panel has Javali", J("document.body.innerText.includes('Javali')"))
    J("(()=>{const a=__t.world.animals.find(a=>a.species==='boar'); window.__ba=a; })()")
    pg.screenshot(path="s_map_boar.png")
    print("boar pos", J("JSON.stringify([Math.round(__ba.x),Math.round(__ba.y)])"))
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    J("(()=>{const d=__t.dungeon; d.flow='x'; d.monsters.length=0; d.px=300; d.py=270; const m=__t.spawnJavalino(2); m.x=480; m.y=270; m.bcd=0; window.__m=m;})()")
    pg.wait_for_timeout(300); print("state", J("__m.st"))
    pg.wait_for_timeout(1300); print("after charge", J("JSON.stringify({st:__m.st, down:__t.dungeon.down, dazed:__t.dungeon.dazed, hp:__t.dungeon.hp})"))
    # dodge test
    J("(()=>{const d=__t.dungeon; d.down=0; d.dazed=0; d.px=300; d.py=270; __m.x=480; __m.y=270; __m.st='chase'; __m.bcd=0; __m.hit=false;})()"); pg.wait_for_timeout(200)
    for i in range(20):
        st=J("__m.st")
        if st=="charge": break
        pg.wait_for_timeout(60)
    J("(()=>{const d=__t.dungeon; d.weapon='bow'; d.dodgeCd=0; __t.bowRoll();})()"); pg.wait_for_timeout(900)
    print("dodge result down", J("__t.dungeon.down"), "dazed", J("__t.dungeon.dazed"))
    J("(()=>{const d=__t.dungeon; d.weapon='melee'; d.px=300; d.py=270; d.mouse={x:600,y:270}; d.parryVis=0.25; __t.boarHit(__m);})()"); print("parry ->", J("JSON.stringify({st:__m.st, t:+__m.t.toFixed(2), down:__t.dungeon.down})"))
    print(errs[:4]); b.close()
