import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));")
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(1000)
    print("btn", J("!!document.getElementById('prep-train')"))
    J("document.getElementById('prep-train').click()"); pg.wait_for_timeout(3000)
    print("training", J("JSON.stringify([__t.dungeon.training, __t.dungeon.monsters.length, __t.dungeon.monsters[0].name, __t.dungeon.flow, document.getElementById('tr-hud').style.display])"))
    res={}
    for k in ["eq_espada","eq_clava","eq_machado","eq_lanca"]:
        J(f"__t.trainWeapon('{k}')"); J("__t.TR.q=1")
        r=J("""()=>{const d=__t.dungeon,m=d.monsters[0]; __t.trainWeapon(__t.wpnKey(d.hero)); const T0=performance.now(); __t.TR.hits=[];__t.TR.tot=0;__t.TR.n=0;__t.TR.crits=0;__t.TR.direct=0;
            let n=0; for(let i=0;i<300;i++){ d.px=m.x-30; d.py=m.y; d.mouse={x:m.x+50,y:m.y}; d.cd=0; d.combo=i%3; d.comboT=1; __t.swingBasic(); }
            return [__t.TR.n, +(__t.TR.tot/__t.TR.n).toFixed(2), __t.TR.direct? +(__t.TR.crits/__t.TR.direct*100).toFixed(1):0, m.hp===m.hpMax, m.alive]; }""")
        print(k, r)
    print("stats", J("JSON.stringify(__t.heroStats(__t.dungeon.hero), (k,v)=>typeof v==='number'?+v.toFixed(2):v)"))
    print("attrs", J("JSON.stringify(__t.dungeon.hero.attrs)"))
    J("__t.trainAttr('forca',3)") if False else None
    for i in range(3): J("__t.trainAttr('forca',1)")
    print("for+3 stats", J("__t.heroStats(__t.dungeon.hero).melee.toFixed(2)"), J("__t.attrOf(__t.dungeon.hero,'forca')"))
    # arco
    J("__t.trainWeapon('eq_arco')"); print("weapon", J("__t.dungeon.weapon"))
    # lobo de treino + não morre
    J("document.querySelector('[data-tr=\"wolf\"]').click()"); pg.wait_for_timeout(300)
    print("wolf", J("__t.dungeon.monsters.filter(m=>!m.dummy&&m.alive).length"))
    J("(()=>{const d=__t.dungeon; d.hp=1; const m=d.monsters.find(m=>!m.dummy&&m.alive); __t.wolfStrike(m,null,30,0);})()")
    print("alive after lethal", J("JSON.stringify([__t.dungeon.dead, __t.dungeon.hp, __t.dungeon.hpMax])"))
    pg.wait_for_timeout(600)
    box=pg.locator("#dungeon-view").bounding_box(); pg.screenshot(path="s_treino.png")
    # afixos
    print("affix rolls", J("(()=>{const o={};for(const q of [0,1,2,3]){let c=0,ex=[];for(let i=0;i<200;i++){const it=__t.mkItem('eq_espada'); it.q=q; it.af=undefined; it.durMax=null; __t.eqDurInit(it); c+=Object.keys(it.af).length; if(i<2) ex.push(__t.afText(it));} o[q]=[c/200,ex];} return JSON.stringify(o);})()"))
    # sair restaura
    J("document.querySelector('[data-tr=\"exit\"]').click()"); pg.wait_for_timeout(2500)
    print("after exit", J("JSON.stringify([__t.dungeon.active, __t.dungeon.training, __h.state, !!__h._trAttr, __t.econ.noWear, __t.ensureEquip(__h).maoD && __t.ensureEquip(__h).maoD.def.key, document.getElementById('tr-hud').style.display])"))
    print(errs[:5]); b.close()
