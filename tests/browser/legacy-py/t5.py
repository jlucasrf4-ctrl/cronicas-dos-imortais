import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
errs=[]
def J(pg,code): return pg.evaluate(code)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":860})
    pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.on("console",lambda m: errs.append("C:"+m.text) if m.type=="error" else None)
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(2200)
    print("typeof t:",J(pg,"typeof __t"))
    J(pg,"__t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.updateHeroPanelUI()")
    # --- tiers
    print("shapes",J(pg,"['carne','presa','pele','escudo','erva','gema'].map(k=>[0,1,2].map(t=>__t.tierShape(k,t).map(r=>r.join('')).join('/')).join(' | '))"))
    print("val",J(pg,"[0,1,2].map(t=>{const it={def:__t.ITEM_DEFS.carne,tier:t};return __t.itemVal(it)})"))
    print("dist",J(pg,"(()=>{const c=[0,0,0];for(let i=0;i<4000;i++)c[__t.rollTier(false)]++;const d=[0,0,0];for(let i=0;i<4000;i++)d[__t.rollTier(true)]++;return [c,d]})()"))
    J(pg,"__t.giveMeat(window.__h,12)")
    print("meat tiers",J(pg,"window.__h.inv.items.map(i=>i.tier+':'+i.shape.length+'x'+i.shape[0].length).join(' ')"))
    # --- recursos como itens
    J(pg,"__t.resAdd(window.__h,'stone',10); __t.resAdd(window.__h,'feather',5)")
    print("res",J(pg,"(()=>{const h=window.__h;const q=__t.qvInv(h);return {stone:__t.resCount(h,'stone'),feather:__t.resCount(h,'feather'),qv:q.items.map(i=>i.def.key+i.n+'@'+i.x+','+i.y),pack:h.inv.items.filter(i=>i.def.res).map(i=>i.def.key+i.n),cap:__t.arrowCap(h),arrows:__t.econ.quiver.n,cols:q.cols}})()"))
    # abrir mochila (janela) e mover pedra da aljava para mochila com shift-click
    J(pg,"__t.openBag(window.__h.id)"); pg.wait_for_timeout(400); pg.screenshot(path="bag2.png")
    print("grids",J(pg,"__t.invGrids.length"))
    J(pg,"(()=>{const h=window.__h;const q=__t.qvInv(h);const it=q.items[0];const gr=__t.invGrids.find(g=>g.inv===q);__t.quickMove(it,gr);__t.renderInv();})()")
    print("after quickMove",J(pg,"(()=>{const h=window.__h;const q=__t.qvInv(h);return {qv:q.items.map(i=>i.def.key+i.n),pack:h.inv.items.filter(i=>i.def.res).map(i=>i.def.key+i.n)}})()"))
    # mover da mochila para a aljava
    J(pg,"(()=>{const h=window.__h;const it=h.inv.items.find(i=>i.def.res);const gr=__t.invGrids.find(g=>g.inv===h.inv);__t.quickMove(it,gr);__t.renderInv();})()")
    print("back",J(pg,"(()=>{const h=window.__h;const q=__t.qvInv(h);return {qv:q.items.map(i=>i.def.key+i.n),pack:h.inv.items.filter(i=>i.def.res).map(i=>i.def.key+i.n)}})()"))
    # arrastar de verdade: pointer events da primeira pedra da mochila->aljava
    print("craft total",J(pg,"__t.resTotal('stone')"), J(pg,"(()=>{__t.resSpend(window.__h,'stone',3);return __t.resCount(window.__h,'stone')})()"))
    pg.screenshot(path="bag3.png")
    # --- loja
    J(pg,"__t.econ.test=false; __t.econ.gold=1000")
    J(pg,"document.getElementById('btn-market').click()"); pg.wait_for_timeout(300)
    print("bags html",J(pg,"document.getElementById('mk-bags').innerText.replace(/\\n/g,' | ')"))
    pg.click("#mk-bags [data-bag]"); pg.click("#mk-bags [data-chest]"); pg.click("#mk-bags [data-mkq]")
    print("after buy",J(pg,"({inv:[__t.ensureInv(window.__h).cols,__t.ensureInv(window.__h).rows],stash:[__t.econ.stash.cols,__t.econ.stash.rows],q:__t.econ.quiver.type,gold:__t.econ.gold,qcols:__t.qvInv(window.__h).cols})"))
    pg.screenshot(path="market.png")
    print("ERRS",errs[:8]); b.close()
