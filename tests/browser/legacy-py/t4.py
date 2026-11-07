import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":860})
    pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(2200)
    # 1. raposa: painel completo
    r=pg.evaluate("""(()=>{const f=__t.world.wild.find(w=>w.alive&&w.species==='fox')||__t.addWild('fox',300,300); __t.openWildInspector(f);
      const g=id=>document.getElementById(id).textContent; return {name:g('insp-name'),hunger:g('v-hunger'),thirst:g('v-thirst'),energy:g('v-energy'),health:g('v-health'),state:g('insp-state'),bars:['b-hunger','b-thirst','b-energy','b-health'].map(i=>document.getElementById(i).style.width)}})()""")
    print(r)
    pg.wait_for_timeout(300); pg.screenshot(path="fox.png")
    # 2. carne -> mochila
    pg.evaluate("__t.econ.test=true; window.__h=__t.createHero('Ayla'); __t.updateHeroPanelUI()")
    print(pg.evaluate("(()=>{const h=window.__h; __t.giveMeat(h,8); return {pack:__t.meatInPack(h),counter:h.loot.meat,total:__t.meatTotal(),sellable:h.inv.items.filter(i=>i.def.key==='carne').length}})()"))
    # 3. mochila (janela) + clique no personagem
    pg.evaluate("__t.openHeroInspector(window.__h)"); pg.wait_for_timeout(200)
    pg.click("[data-act=ibag]"); pg.wait_for_timeout(400)
    pg.screenshot(path="bag.png")
    # 4. janelas: arrastar e fechar
    box=pg.locator("#hero-panel h2").bounding_box(); pg.mouse.move(box["x"]+20,box["y"]+8); pg.mouse.down(); pg.mouse.move(box["x"]+400,box["y"]+200,steps=6); pg.mouse.up()
    pg.click("#inspector-close"); pg.wait_for_timeout(300); pg.locator("#stats-panel .win-x").click(); pg.wait_for_timeout(200)
    pg.screenshot(path="win.png")
    print(pg.evaluate("({hp:document.getElementById('hero-panel').style.left, hidden:document.getElementById('stats-panel').classList.contains('win-hidden'), dock:document.getElementById('win-dock').innerText.replace(/\\n/g,' | ')})"))
    print(errs[:5]); b.close()
