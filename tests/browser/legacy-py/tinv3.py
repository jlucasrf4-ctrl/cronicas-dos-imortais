import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(800)
    J("const inv=__t.ensureInv(__h); for (const k of ['eq_machado','pele','carne','gema']) { const it=__t.mkItem(k); __t.eqDurInit(it); __t.placeIn(inv,it); }")
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(800); pg.screenshot(path="s_prep3.png")
    J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    J("const d=__t.dungeon; d.flow='x'; d.monsters.length=0; d.loot.push({key:'reliquia',x:d.px+5,y:d.py,t:0,ttl:0,tier:0}); const q=__t.qvInv(d.hero); const g=__t.mkItem('gema'); __t.placeIn(q,g); window.__g=g; __t.toggleInv(true)"); pg.wait_for_timeout(700)
    pg.screenshot(path="s_inv3.png")
    def center_of_item(gridsel, expr):
        return J(f"(()=>{{const g=document.querySelector('{gridsel}'), r=g.getBoundingClientRect(), it={expr}; let rr=0,cc=0; for(let i=0;i<it.shape.length;i++)for(let j=0;j<it.shape[0].length;j++) if(it.shape[i][j]){{rr=i;cc=j;break;}} return [r.left+(it.x+cc+0.5)*14, r.top+(it.y+rr+0.5)*14]}})()")
    # quiver -> backpack
    x,y=center_of_item('#inv-qv','__g'); gb=J("(()=>{const r=document.getElementById('inv-grid').getBoundingClientRect(); return [r.right-50, r.bottom-50]})()")
    pg.mouse.move(x,y); pg.mouse.down(); pg.mouse.move(x+20,y+5); pg.mouse.move(*gb, steps=5); pg.mouse.up(); pg.wait_for_timeout(300)
    print("gem in backpack?", J("__t.ensureInv(__t.dungeon.hero).items.includes(__g)"), "in qv?", J("__t.qvInv(__t.dungeon.hero).items.includes(__g)"))
    # put another gem into quiver and drag to ground
    J("const q=__t.qvInv(__t.dungeon.hero); const g=__t.mkItem('gema'); __t.placeIn(q,g); window.__g2=g; __t.renderInv()"); pg.wait_for_timeout(300)
    x,y=center_of_item('#inv-qv','__g2'); gg=J("(()=>{const r=document.getElementById('inv-ground').getBoundingClientRect(); return [r.right-50, r.bottom-50]})()")
    pg.mouse.move(x,y); pg.mouse.down(); pg.mouse.move(x+20,y+5); pg.mouse.move(*gg, steps=5); pg.mouse.up(); pg.wait_for_timeout(300)
    print("gem2 on ground?", J("__t.dungeon.gInv.items.includes(__g2)"), "in qv?", J("__t.qvInv(__t.dungeon.hero).items.includes(__g2)"))
    # doll: dblclick axe equips to active set
    x,y=center_of_item('#inv-grid',"__t.ensureInv(__t.dungeon.hero).items.find(i=>i.def.key==='eq_machado')")
    pg.mouse.dblclick(x,y); pg.wait_for_timeout(300); print("maoD", J("__t.ensureEquip(__t.dungeon.hero).maoD && __t.ensureEquip(__t.dungeon.hero).maoD.def.key"))
    # drag sword (now in backpack) to arma 2 slot
    x,y=center_of_item('#inv-grid',"__t.ensureInv(__t.dungeon.hero).items.find(i=>i.def.key==='eq_espada')")
    s2=J("(()=>{const r=document.querySelector('#inv-doll [data-eqs=maoD2]').getBoundingClientRect(); return [r.left+15,r.top+15]})()")
    pg.mouse.move(x,y); pg.mouse.down(); pg.mouse.move(x+20,y+5); pg.mouse.move(*s2, steps=5); pg.mouse.up(); pg.wait_for_timeout(300)
    print("maoD2", J("(__t.ensureEquip(__t.dungeon.hero).maoD2||{def:{}}).def.key"))
    pg.screenshot(path="s_inv3b.png")
    J("__t.toggleInv(false)"); pg.wait_for_timeout(200)
    for i in range(4): J("__t.dungeon.cd=0; __t.switchWeapon()"); print("Q", J("[__t.setNo(__t.dungeon.hero), __t.dungeon.weapon, (__t.ensureEquip(__t.dungeon.hero).maoD||{def:{}}).def.key]"))
    # grab by image: click on emo area of the axe/whatever bounding box empty
    print(errs[:5]); b.close()
