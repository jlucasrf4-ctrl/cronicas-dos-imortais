import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.econ.introDone=true; __t.econ.campTut=3; __t.openPrep(__h.id)"); pg.wait_for_timeout(600); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(5000)
    J("const d=__t.dungeon; d.toasts.length=0; d.modalOpen=true; __t.spawnDungeonToast('🔥 Fogueira acesa!', d.px, d.py-40, '#ffb347', 14); __t.spawnDungeonToast('+1 Pedra', d.px, d.py-20, '#cfe8a0')")
    l0=J("__t.dungeon.toasts.map(t=>t.life)"); pg.wait_for_timeout(1500); l1=J("__t.dungeon.toasts.map(t=>t.life)")
    print("paused toast life", l0, "->", l1); J("__t.dungeon.modalOpen=false"); print(errs[:3]); b.close()
