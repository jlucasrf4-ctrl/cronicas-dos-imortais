import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(600)
    J("__t.gsRun('JOIAS'); __t.gsRun('JOIAS'); __t.gsRun('JOIAS'); __t.gsRun('PEDRAS'); let c=0; for(let i=0;i<300;i++){ if(!__t.resAdd(__h,'stone',1)) c++; } window.__c=c;"); print('stones', J('__t.ensureInv(__h).items.filter(i=>i.def.key===\'pedra_rara\').length'), J('__t.econ.stash.items.filter(i=>i.def.key===\'pedra_rara\').map(i=>__t.itName(i)+\'|\'+__t.icoKeyOf(i)+\'|\'+__t.itemVal(i)).slice(0,6)'))
    J("document.getElementById('btn-chest').click()"); pg.wait_for_timeout(700)
    pg.locator("#chest-grid .inv-item:has(.ico-gx_safira_3_1), #chest-grid .inv-item").filter(has=pg.locator('[class*=ico-g]')).first.locator('.inv-cell').first.hover(); pg.wait_for_timeout(600); pg.screenshot(path="w_tip.png")
    pg.mouse.move(5,840); J("document.getElementById('chest-modal').classList.remove('open'); document.querySelector('#chest-modal .btn')&&0")
    # map tokens: zoom on wolves
    J("const a=__t.world.animals.find(a=>a.species==='wolf'); window.__a=a; const s=__t.camera.minScale*14; __t.camera.scale=s; __t.camera.tx=683-a.x*s; __t.camera.ty=430-a.y*s;"); pg.wait_for_timeout(900); pg.screenshot(path="w_map1.png")
    J("const a=__t.world.animals.find(a=>a.species==='boar'); const s=__t.camera.minScale*14; __t.camera.scale=s; __t.camera.tx=683-a.x*s; __t.camera.ty=430-a.y*s; __t.openInspector(__a)"); pg.wait_for_timeout(900); pg.screenshot(path="w_map2.png")
    J("document.getElementById('insp-portrait').click()"); pg.wait_for_timeout(600); pg.screenshot(path="w_card.png")
    J("document.getElementById('an-card').classList.remove('open')")
    w=J("(()=>{const w=__t.world.wild.find(w=>w.species==='fox'&&w.alive); __t.openWildInspector(w); document.getElementById('insp-portrait').click(); return w.coat+'/'+w.sex})()"); print("fox",w); pg.wait_for_timeout(600); pg.screenshot(path="w_card2.png")
    J("document.getElementById('an-card').classList.remove('open')")
    # cook drawing
    J("const cv=document.createElement('canvas'); cv.id='cook-cv'; cv.width=420; cv.height=260; cv.style='position:fixed;left:10px;top:10px;z-index:9999'; document.body.appendChild(cv); __t.CAMP.cook={a:0.2,b:0.1,down:'a',heat:1,ht:0,up:false,t:0,last:performance.now(),tier:1,an:'javali',flare:0}; __t.cookDraw();"); pg.wait_for_timeout(300); pg.screenshot(path="w_cook1.png", clip={"x":0,"y":0,"width":440,"height":280})
    J("__t.CAMP.cook.a=0.85; __t.CAMP.cook.b=0.8; __t.cookDraw();"); pg.wait_for_timeout(200); pg.screenshot(path="w_cook2.png", clip={"x":0,"y":0,"width":440,"height":280})
    print(errs[:5]); b.close()
