import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(800)
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    setup="(()=>{const d=__t.dungeon; d.flow='x'; d.monsters.length=0; d.px=300; d.py=270; d.down=0; d.dazed=0; d.rollGuard=0; d.dodgeGuard=0; d.parryVis=0; d.guard=false; d.gstam=100; d.guardBroken=0; d.invuln=0; d.weapon='melee'; d.mouse={x:600,y:270}; const m=__t.spawnJavalino(2); m.x=320; m.y=270; window.__m=m;})()"
    R="JSON.stringify({down:__t.dungeon.down, st:__m.st, t:+(__m.t||0).toFixed(2), gst:Math.round(__t.dungeon.gstam)})"
    J(setup); J("__t.dungeon.rollGuard=0.3; __t.boarHit(__m)"); print("roll:", J(R))
    J(setup); J("__t.dungeon.guard=true; __t.boarHit(__m)"); print("shield:", J(R))
    J(setup); J("__t.dungeon.parryVis=0.2; __t.boarHit(__m)"); print("parry:", J(R))
    J(setup); J("__t.boarHit(__m)"); print("hit:", J(R), "dazed", J("__t.dungeon.dazed"))
    J(setup); J("__m.x=480; __m.bcd=0;"); pg.wait_for_timeout(2600); print("live charge result:", J(R))
    pg.screenshot(path="s_boar.png")
    print(errs[:3]); b.close()
