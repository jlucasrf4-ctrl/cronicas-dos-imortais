import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e))); pg.on("console", lambda m: print("LOG", m.text) if "DBG" in m.text else None)
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(800)
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    J("const d=__t.dungeon; d.flow='x'; d.monsters.length=0; const q=__t.qvInv(d.hero); const g=__t.mkItem('gema'); __t.placeIn(q,g); window.__g=g; __t.toggleInv(true)"); pg.wait_for_timeout(700)
    print(J("JSON.stringify({x:__g.x,y:__g.y,sh:__g.shape, qcols:__t.qvInv(__t.dungeon.hero).cols})"))
    x,y=J("(()=>{const g=document.querySelector('#inv-qv'), r=g.getBoundingClientRect(); return [r.left+(__g.x+0.5)*14, r.top+(__g.y+0.5)*14]})()")
    gb=J("(()=>{const r=document.getElementById('inv-grid').getBoundingClientRect(); return [r.right-20, r.bottom-20]})()")
    print("el at", J(f"(()=>{{const e=document.elementFromPoint({x},{y}); return e.className+' '+e.id+' '+(e.dataset.r)+' '+(e.parentElement&&e.parentElement.className)}})()"))
    pg.mouse.move(x,y); pg.mouse.down(); pg.wait_for_timeout(50); print("drag", J("(()=>{ try { return JSON.stringify(Object.keys(window)) && 'x' } catch(e){return e+''} })()"))
    pg.mouse.move(x+20,y+5); pg.mouse.move(*gb, steps=5); pg.wait_for_timeout(50)
    print("over", J("(()=>{const d=__t.invDrag; return d? JSON.stringify({moved:d.moved,over:d.over&&d.over.el.id,gx:d.gx,gy:d.gy,from:d.from.el.id}):null})()"))
    pg.mouse.up(); pg.wait_for_timeout(300)
    print("gem in backpack?", J("__t.ensureInv(__t.dungeon.hero).items.includes(__g)"))
    print(errs[:5]); b.close()
