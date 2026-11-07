import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.econ.introDone=true; __t.econ.campTut=3; __t.openPrep(__h.id)"); pg.wait_for_timeout(600); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(5000)
    J("const h=__t.dungeon.hero, inv=__t.ensureInv(h); inv.items=inv.items.filter(i=>i.def.slot); for(let i=0;i<5;i++) __t.tryAddToInv(inv,'erva'); for(let i=0;i<7;i++) __t.tryAddToInv(inv,'folhama'); window.MEAT_SRC='coelho'; for(let i=0;i<4;i++) __t.tryAddToInv(inv,'carne');")
    print("packs", J("__t.ensureInv(__t.dungeon.hero).items.filter(i=>!i.def.slot).map(i=>i.def.key+(i.an?'('+i.an+')':'')+' n'+(i.n||1)+'/'+__t.packCap(i)+' cells'+i.shape.flat().filter(Boolean).length)"))
    J("__t.dungeon.hp=__t.dungeon.hpMax*0.5; __t.dungeon.herbCd=0"); J("__t.healHerb()"); print("erva after herb", J("__t.ensureInv(__t.dungeon.hero).items.filter(i=>i.def.key==='erva').map(i=>i.n||1)"))
    J("__t.toggleInv(true)"); pg.wait_for_timeout(600); pg.screenshot(path="s1_packs.png")
    # shift-drag split folhama
    box=J("(()=>{const inv=__t.ensureInv(__t.dungeon.hero), it=inv.items.find(i=>i.def.key==='folhama'&&(i.n||1)>1); const g=[...document.querySelectorAll('*')].find(e=>e._gr&&e._gr.inv===inv&&e.getBoundingClientRect().width>0); const r=g.getBoundingClientRect(); let rr=0,cc=0; it.shape.forEach((row,ri)=>row.forEach((v,ci)=>{ if(v&&!rr&&!cc){rr=ri;cc=ci} })); const k=r.width/g.offsetWidth; return [r.left+(it.x+cc+0.5)*14*k, r.top+(it.y+rr+0.5)*14*k, it.n, r.left, r.top]})()")
    print("folhama n before", box[2], J("(()=>{const e=document.elementFromPoint(%f,%f); const g=__t.gridElOf(e); if(!g) return 'nogrid '+(e&&e.className); const c=__t.gridCell(g,{clientX:%f,clientY:%f}); const f=__t.itemAt(g._gr,c[0],c[1],false); return [e.className, c, f&&f.it.def.key, f&&f.it.n]})()" % (box[0],box[1],box[0],box[1])))
    pg.keyboard.down("Shift"); pg.mouse.move(box[0],box[1]); pg.mouse.down(); pg.mouse.move(box[0]+120, box[1]+150, steps=6); pg.mouse.up(); pg.keyboard.up("Shift"); pg.wait_for_timeout(300)
    print("after split", J("__t.ensureInv(__t.dungeon.hero).items.filter(i=>i.def.key==='folhama').map(i=>i.n||1)"))
    # arrows to bag
    q0=J("__t.econ.quiver.n"); ok=J("(()=>{const h=__t.dungeon.hero, qv=__t.qvInv(h), pk=qv.items.find(i=>i.def.key==='flecha'); return __t.arrowsToBag(pk, null, __t.ensureInv(h))})()"); print("toBag", ok, q0, "->", J("__t.econ.quiver.n"), "bundle", J("__t.ensureInv(__t.dungeon.hero).items.filter(i=>i.def.key==='feixe_flechas').map(i=>i.n)"))
    J("(()=>{const h=__t.dungeon.hero, inv=__t.ensureInv(h), b=inv.items.find(i=>i.def.key==='feixe_flechas'); __t.bundleReload(b, inv)})()"); print("reload ->", J("__t.econ.quiver.n"), J("__t.ensureInv(__t.dungeon.hero).items.filter(i=>i.def.key==='feixe_flechas').map(i=>i.n)"))
    J("__t.renderInv()"); pg.wait_for_timeout(300)
    # item menu analyze for sword in bag
    J("__t.tryAddToInv(__t.ensureInv(__t.dungeon.hero),'eq_machado'); __t.renderInv()"); pg.wait_for_timeout(300)
    print("menu", J("(()=>{const inv=__t.ensureInv(__t.dungeon.hero), it=inv.items.find(i=>i.def.key==='eq_machado'); const g=[...document.querySelectorAll('*')].find(e=>e._gr&&e._gr.inv===inv); __t.invItemMenu(it, g._gr, 300, 300); return [...document.querySelectorAll('#inv-menu button')].map(b=>b.textContent)})()"))
    pg.screenshot(path="s2_menu.png")
    print(errs[:4]); b.close()
