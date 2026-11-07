import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(800)
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    print(J("JSON.stringify({camp:__t.dungeon.camp, mode:__t.dungeon.mode})"))
    J("const d=__t.dungeon; d.monsters.forEach(m=>m.alive=false); __h.hunger=70; __t.hurtPlayer(25,0,null); d.sinceHurt=0"); pg.wait_for_timeout(9000)
    print(J("JSON.stringify({hp:Math.round(__t.dungeon.hp),max:__t.dungeon.hpMax,w:Math.round(__t.dungeon.wound),cap:Math.round(__t.hpCap()),hud:document.getElementById('surv-hud').textContent})"))
    pg.screenshot(path="s_surv.png", clip={"x":0,"y":0,"width":700,"height":110})
    print(errs[:5]); b.close()
