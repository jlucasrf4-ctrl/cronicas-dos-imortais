import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def drag(pg, a, b):
    pg.mouse.move(*a); pg.mouse.down(); pg.mouse.move(a[0]+15,a[1]+5); pg.mouse.move(*b, steps=6); pg.mouse.up(); pg.wait_for_timeout(300)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(800)
    J("const q=__t.qvInv(__h); const g=__t.mkItem('gema'); __t.placeIn(q,g); window.__g=g; __t.openPrep(__h.id)"); pg.wait_for_timeout(800)
    grids=J("__t.invGrids.map(g=>g.el.id+':'+(g.inv.qv?'qv':g.inv===__t.econ.stash?'stash':'inv'))"); print(grids)
    qsel=J("(()=>{const g=__t.invGrids.find(g=>g.inv.qv); g.el.dataset.t='qv'; const b=__t.invGrids.find(g=>!g.inv.qv && g.inv!==__t.econ.stash); b.el.dataset.t='bag'; return 1})()")
    a=J("(()=>{const r=document.querySelector('[data-t=qv]').getBoundingClientRect(); return [r.left+(__g.x+1.5)*14, r.top+(__g.y+1.5)*14]})()"); bb=J("(()=>{const r=document.querySelector('[data-t=bag]').getBoundingClientRect(); return [r.right-25, r.bottom-25]})()")
    drag(pg,a,bb); print("prep qv->bag", J("__t.ensureInv(__h).items.includes(__g)"))
    J("__t.closePrep && __t.closePrep()")
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    J("const d=__t.dungeon; d.flow='x'; d.monsters.length=0; const q=__t.qvInv(d.hero); const g=__t.mkItem('gema'); __t.placeIn(q,g); window.__g2=g; __t.toggleInv(true)"); pg.wait_for_timeout(600)
    a=J("(()=>{const r=document.getElementById('inv-qv').getBoundingClientRect(); return [r.left+(__g2.x+1.5)*14, r.top+(__g2.y+1.5)*14]})()"); gg=J("(()=>{const r=document.getElementById('inv-ground').getBoundingClientRect(); return [r.right-30, r.bottom-20]})()")
    drag(pg,a,gg); print("dg qv->ground", J("__t.dungeon.gInv.items.includes(__g2)"))
    J("const q=__t.qvInv(__t.dungeon.hero); const g=__t.mkItem('pena'); __t.placeIn(q,g); window.__g3=g; __t.renderInv()"); pg.wait_for_timeout(300)
    a=J("(()=>{const r=document.getElementById('inv-qv').getBoundingClientRect(); const s=__g3.shape; let rr=0,cc=0; for(let i=0;i<s.length;i++)for(let j=0;j<s[0].length;j++) if(s[i][j]){rr=i;cc=j;} return [r.left+(__g3.x+cc+0.5)*14, r.top+(__g3.y+rr+0.5)*14]})()"); bb=J("(()=>{const r=document.getElementById('inv-grid').getBoundingClientRect(); return [r.right-20, r.bottom-20]})()")
    print("pena in qv", J("__t.qvInv(__t.dungeon.hero).items.includes(__g3)"), J("JSON.stringify([__g3.x,__g3.y,__g3.shape,__g3.n])"), J(f"(()=>{{const e=document.elementFromPoint({a[0]},{a[1]}); return e.className+' '+e.dataset.r}})()"))
    pg.mouse.move(*a); pg.mouse.down(); pg.mouse.move(a[0]+15,a[1]+5); pg.mouse.move(*bb, steps=6); print("dd", J("(()=>{const d=__t.invDrag; return d? JSON.stringify({key:d.it.def.key,over:d.over&&d.over.el.id,gx:d.gx,gy:d.gy}):null})()")); pg.mouse.up(); pg.wait_for_timeout(300)
    print("dg qv->bag (pena)", J("__t.ensureInv(__t.dungeon.hero).items.includes(__g3)"))
    print(errs[:5]); b.close()
