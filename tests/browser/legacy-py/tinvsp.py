import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(800)
    J("const inv=__t.ensureInv(__h); for (const k of ['eq_lanca','eq_lanca','eq_machado','eq_clava']) { const it=__t.mkItem(k); __t.eqDurInit(it); __t.placeIn(inv,it); } const q=__t.mkItem('eq_lanca'); q.shape=[[1],[1],[1],[1],[1],[1]]; __t.placeIn(inv,q); __t.fixLongShapes();")
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(1200); pg.screenshot(path="s_inv_lanca.png")
    print(J("__t.ensureInv(__h).items.map(i=>i.def.key+':'+i.shape.length+'x'+i.shape[0].length).join(' ')"), errs[:3]); b.close()
