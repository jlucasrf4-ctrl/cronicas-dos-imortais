import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J(pg,"__t.enterGame(); __t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.openPrep(__h.id)"); pg.wait_for_timeout(600)
    J(pg,"document.getElementById('prep-go').click()"); pg.wait_for_timeout(3000)
    pg.screenshot(path="i_start.png")
    J(pg,"""(()=>{const d=__t.dungeon; d.flow='x'; const T=d.tile; d.px=d.entrance.x+10; d.py=d.entrance.y; const X=d.px, Y=d.py;
      __t.setBanner("🐺 HORDA 2/3", "4 lobos + 1 javalino", 3, "#ffb37a");
      __t.spawnDungeonToast("Bloqueado", X+60, Y-30, "#9fe3ff", 11); __t.spawnDungeonToast("Esquivou!", X-60, Y-20, "#9fe3ff"); __t.spawnDungeonToast("+ Folha de Folhama", X+20, Y+30, "#ffe08a"); __t.spawnDungeonToast("-7", X+90, Y, "#ff6b6b", 14); __t.spawnDungeonToast("Parry parcial", X-90, Y+20, "#ffb347", 11);
      document.getElementById('sword-hud').style.display='block'; })()""")
    pg.wait_for_timeout(250); pg.screenshot(path="i_toasts.png")
    print(errs[:4]); b.close()
