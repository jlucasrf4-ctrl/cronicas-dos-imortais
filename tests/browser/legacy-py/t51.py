import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":800})
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(4000)
    J(pg,"__t.enterGame(); window.__h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.econ.gold=300")
    # visita C3, volta para A5: o ecossistema de C3 fica guardado
    J(pg,"__t.quadActivate('2,2')"); n3=J(pg,"__t.world.animals.filter(a=>a.alive).length"); J(pg,"__t.quadActivate('0,4')")
    print("guardados:", J(pg,"Object.keys(__t.QUAD.store)"), "animais C3:", n3)
    print("save:", J(pg,"__t.saveTo('1')"), J(pg,"(localStorage.getItem('cdi.save.1').length/1024|0)+'KB'"))
    J(pg,"__t.quadActivate('2,2')"); J(pg,"__t.loadFrom('1')")
    print("após load:", J(pg,"[__t.quadName(__t.QUAD.active), Object.keys(__t.QUAD.store), __t.world.animals.length, __h && __t.world.heroes[0].camp.x|0]"))
    # save antigo (mundo pequeno): K ausente e coordenadas /4
    J(pg,"""(()=>{const d=JSON.parse(localStorage.getItem('cdi.save.1')); delete d.K; for(const h of d.world.heroes){h.x/=4;h.y/=4;h.camp.x/=4;h.camp.y/=4;} delete d.world.qstore; delete d.world.activeQ; localStorage.setItem('cdi.save.2',JSON.stringify(d)); localStorage.setItem('cdi.savemeta.2',localStorage.getItem('cdi.savemeta.1'));})()""")
    J(pg,"__t.loadFrom('2')")
    print("migrado:", J(pg,"[__t.world.heroes[0].camp.x|0, __t.world.heroes[0].camp.y|0, __t.quadName(__t.QUAD.active), __t.world.animals.length, __t.world.waterPoints.length]"))
    # caçada em outro quadrante: a região ativa vai junto e fica presa enquanto caça
    J(pg,"(()=>{const h=__t.world.heroes[0], ct=__t.CITIES.find(c=>c.id==='rio'); h.task={x:ct.x+40,y:ct.y+30,killsDone:0,species:'rabbit',maxMin:700}; h.state='traveling';})()")
    pg.wait_for_timeout(1500); print("caçada:", J(pg,"__t.quadName(__t.QUAD.active)"))
    print(errs[:5]); b.close()
