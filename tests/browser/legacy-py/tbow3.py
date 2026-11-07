import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
from PIL import Image
import numpy as np
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); __t.OPT.autoRes=false; window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(800)
    J("__t.launchTraining(__h.id)"); pg.wait_for_timeout(3800)
    J("document.querySelector('[data-tr=\"min\"]').click(); __t.D3.ZM=3; window.dispatchEvent(new Event('resize')); __t.trainWeapon('eq_arco')"); pg.wait_for_timeout(800)
    def dark():
        pg.screenshot(path="tmp.png"); a=np.array(Image.open("tmp.png").convert("L").crop((600,250,780,480))); return round(float((a<40).mean()),3)
    print("base", dark())
    for k in J("Object.keys(__t.GL3.hero)"):
        J(f"__t.GL3.hero['{k}'].ol=false"); pg.wait_for_timeout(250); print(k, dark()); J(f"__t.GL3.hero['{k}'].ol=true")
    print(J("JSON.stringify(__t.GL3.list.filter(it=>it.mesh.ol).map(it=>{const M=it.M; return [Object.keys(__t.GL3.hero).find(k=>__t.GL3.hero[k]===it.mesh)||'?', +Math.hypot(M[0],M[1],M[2]).toFixed(2), +Math.hypot(M[4],M[5],M[6]).toFixed(2), +Math.hypot(M[8],M[9],M[10]).toFixed(2)]}).filter(x=>x[0]!=='?'))"))
    J("__t.OPT.outline=false"); pg.wait_for_timeout(300); print("no outline", dark())
    b.close()
