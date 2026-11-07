import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.world.heroes.forEach(h=>{h.loot=h.loot||{}; h.loot.wood=0;});")
    print("RES", J("Object.keys(__t.RES).join(',')"), "recipes", J("JSON.stringify(__t.RECIPES.map(r=>r.mats))"))
    J("__t.giveItem(__h,'galho',0); __t.giveItem(__h,'galho',0); __t.giveItem(__h,'galho',0); __t.resAdd(__h,'stone',2); __t.resAdd(__h,'feather',1); __h.loot.wood=7")
    print("galho total", J("__t.resTotal('galho')"), "lenha", J("__t.resTotal('wood')"), "forge galho", J("__t.forgeHave(__h,'galho')"))
    J("__t.openCraft()"); pg.wait_for_timeout(300)
    print("craft header:", J("document.getElementById('craft-res').innerText"))
    J("document.querySelector('[data-craft=arrow_stone]').click()"); pg.wait_for_timeout(300)
    print("after craft galho", J("__t.resTotal('galho')"), "lenha", J("__t.resTotal('wood')"), "msg", J("document.getElementById('craft-msg').innerText"))
    pg.screenshot(path="t71.png")
    w0=J("__h.loot.wood"); g0=J("__t.resTotal('galho')")
    J("__h.task={killsDone:0}; __t.collectNode(__h,{kind:'tree',size:'large',readyAt:0})")
    print("tree: lenha +", J("__h.loot.wood")-w0, "galho +", J("__t.resTotal('galho')")-g0)
    print("errs", errs[:3]); b.close()
