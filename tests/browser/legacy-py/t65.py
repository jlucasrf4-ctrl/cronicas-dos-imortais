import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.econ.introDone=true; __t.econ.campTut=3;"); pg.wait_for_timeout(500)
    print("zoom limit", J("[__t.camera.minScale, __t.mapZoomLimit(), __t.camera.scale]")); pg.wait_for_timeout(800); print("scale after enforce", J("__t.camera.scale"))
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(600); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(5000)
    print("stack caps", J("['pedra','pena','penaag'].map(k=>k+':'+__t.ITEM_DEFS[k].stack)"))
    J("const h=__t.dungeon.hero; __t.resAdd(h,'stone',5); __t.resAdd(h,'feather',3);"); J("__t.toggleInv(true)"); pg.wait_for_timeout(600)
    print("packs", J("__t.ensureInv(__t.dungeon.hero).items.concat(__t.qvInv(__t.dungeon.hero).items).filter(i=>['pedra','pena'].includes(i.def.key)).map(i=>i.def.key+' n'+(i.n||1)+' cells'+i.shape.flat().filter(Boolean).length)"))
    print("dbg", J("(()=>{const h=__t.dungeon.hero; const out=[]; for (const inv of [__t.ensureInv(h), __t.qvInv(h)]) for (const it of inv.items) if(it.def.key==='pedra'||it.def.key==='pena'){ const sh=__t.packShapeFor(it, it.n||1); out.push([it.def.key, inv.cols+'x'+inv.rows, it.x, it.y, JSON.stringify(it.shape), JSON.stringify(sh), __t.canPlace(inv, sh, it.x, it.y, it)]);} return JSON.stringify(out)})()"))
    pg.screenshot(path="p_pack.png"); J("__t.toggleInv(false)")
    print("dur", J("(()=>{const e=__t.ensureEquip(__t.dungeon.hero); return Object.keys(e).filter(k=>e[k]).map(k=>k+':'+e[k].dur+'/'+e[k].durMax)})()"))
    # facing: walk right while mouse is to the left
    J("const d=__t.dungeon; d.mouse={x:d.px-200,y:d.py}; d.target=null;"); pg.keyboard.down("KeyD"); pg.wait_for_timeout(900); print("yaw walking right (mouse left)", J("__t.GL3.hyaw.toFixed(2)")); pg.keyboard.up("KeyD")
    pg.screenshot(path="p_face.png")
    print(errs[:4]); b.close()
