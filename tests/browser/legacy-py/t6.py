import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
errs=[]
def J(pg,code): return pg.evaluate(code)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":860})
    pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(2000)
    J(pg,"__t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.resAdd(window.__h,'stone',6); __t.econ.quiver.n=10; __t.openBag(window.__h.id)")
    pg.wait_for_timeout(300)
    # drag da 1a pedra da aljava (pilha 4) para a mochila (célula 0,0)
    q=pg.locator("#bag-qv .inv-item").nth(1)  # nth0 = flechas fixas?
    print("qv items",pg.locator("#bag-qv .inv-item").count())
    items=J(pg,"(()=>{const h=window.__h;return __t.qvInv(h).items.map(i=>[i.def.key,i.n,i.x,i.y])})()"); print(items)
    # localizar o elemento da pedra pela posição x,y
    def cell(gridsel,x,y):
        r=pg.locator(gridsel).bounding_box(); return (r["x"]+x*14+7, r["y"]+y*14+7)
    sx,sy=cell("#bag-qv",items[0][2]+1,items[0][3]+1)
    dx,dy=cell("#bag-pack",1,1)
    pg.mouse.move(sx,sy); pg.mouse.down(); pg.mouse.move(dx,dy,steps=8); pg.mouse.up(); pg.wait_for_timeout(200)
    print("pack",J(pg,"window.__h.inv.items.map(i=>[i.def.key,i.n,i.x,i.y])"),"qv",J(pg,"__t.qvInv(window.__h).items.map(i=>[i.def.key,i.n,i.x,i.y])"))
    # arrastar a pedra restante (2) da aljava para cima da pilha na mochila (merge)
    items=J(pg,"__t.qvInv(window.__h).items.map(i=>[i.def.key,i.n,i.x,i.y])"); sx,sy=cell("#bag-qv",items[0][2]+1,items[0][3]+1)
    pk=J(pg,"window.__h.inv.items.map(i=>[i.def.key,i.n,i.x,i.y])")[0]
    dx,dy=cell("#bag-pack",pk[2]+1,pk[3]+1)
    pg.mouse.move(sx,sy); pg.mouse.down(); pg.mouse.move(dx,dy,steps=8); pg.mouse.up(); pg.wait_for_timeout(200)
    print("merge pack",J(pg,"window.__h.inv.items.map(i=>[i.def.key,i.n])"),"qv",J(pg,"__t.qvInv(window.__h).items.map(i=>[i.def.key,i.n])"))
    # arrastar item da mochila para coluna bloqueada (x=0) da aljava: deve recusar
    pk=J(pg,"window.__h.inv.items.map(i=>[i.def.key,i.n,i.x,i.y])")[0]
    sx,sy=cell("#bag-pack",pk[2]+1,pk[3]+1); dx,dy=cell("#bag-qv",1,6)
    pg.mouse.move(sx,sy); pg.mouse.down(); pg.mouse.move(dx,dy,steps=8); pg.mouse.up(); pg.wait_for_timeout(200)
    print("blocked col -> qv",J(pg,"__t.qvInv(window.__h).items.length"))
    pg.screenshot(path="bag4.png")
    print("ERRS",errs[:6]); b.close()
