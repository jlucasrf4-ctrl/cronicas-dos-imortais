import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":800})
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e))); pg.on("console",lambda m: errs.append(m.text) if m.type in("error","warning") and "ERR_TUNNEL" not in m.text and "GL Driver" not in m.text else None)
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(4000)
    print("ready", J(pg,"[__t.MAPART.ready, __t.QUAD.active, __t.quadName(__t.QUAD.active), JSON.stringify(__t.CONFIG.SIM_BOUNDS), __t.world.animals.length, __t.world.veg.length, __t.world.waterPoints.length]"))
    J(pg,"__t.enterGame(); __t.world.tick=12*60; const h=__t.createHero('Ayla',__t.bornFromSeed(777)); window.__h=h")
    print("camp", J(pg,"[__h.camp.x|0, __h.camp.y|0, __t.quadName(__t.quadOf(__h.camp.x,__h.camp.y))]"))
    pg.wait_for_timeout(2500); pg.screenshot(path="q1.png")
    J(pg,"(()=>{const c=__t.camera; c.scale=c.minScale; c.tx=0; c.ty=0; __t.constrainCamera(); __t.applyCameraTransform();})()"); pg.wait_for_timeout(3500); pg.screenshot(path="q_world.png")
    # move câmera para Vila do Rio (outro quadrante) e espera trocar a região
    J(pg,"(()=>{const c=__t.camera, ct=__t.CITIES.find(x=>x.id==='rio'), vw=innerWidth, vh=innerHeight; c.scale=1.2; c.tx=vw/2-ct.x*c.scale; c.ty=vh/2-ct.y*c.scale; __t.applyCameraTransform();})()"); pg.wait_for_timeout(4000)
    print("após mover:", J(pg,"[__t.quadName(__t.QUAD.active), __t.world.animals.length, Object.keys(__t.QUAD.store)]"))
    pg.screenshot(path="q_rio.png")
    print(errs[:6]); b.close()
