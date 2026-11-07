import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":390,"height":844},device_scale_factor=2,is_mobile=True,has_touch=True); pg=ctx.new_page(); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J(pg,"__t.enterGame(); window.__h=__t.createHero('Ayla',__t.bornFromSeed(777)); const st=__t.econ.stash; for(const k of ['pele','pele','pele']) __t.tryAddToInv(st,k); __t.openForge()")
    pg.wait_for_timeout(400); J(pg,"__t.forgeStart('make','eq_botas')"); pg.wait_for_timeout(500); pg.screenshot(path="fm_hit.png")
    J(pg,"__t.openPrep(__h.id)"); pg.wait_for_timeout(300); J(pg,"(()=>{const e=__t.ensureEquip(__h); e.maoD.dur=10; e.peito.dur=30; __t.prep.open && document.getElementById('prep-go') ; })()")
    J(pg,"document.getElementById('fg-x').click()"); pg.wait_for_timeout(500); pg.screenshot(path="fm_prep.png")
    print(errs[:4]); b.close()
