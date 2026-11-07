import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c,*a): return pg.evaluate(c,*a)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J(pg,"__t.enterGame(); __t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));")
    J(pg,"__t.openPrep(__h.id)"); pg.wait_for_timeout(1200)
    J(pg,"document.getElementById('prep-go').click()"); pg.wait_for_timeout(3000)
    for k in ["eq_espada","eq_lanca","eq_clava","eq_machado"]:
        r=J(pg,"""(k)=>{const d=__t.dungeon; d.flow='x'; let tot=0, st=0, bl=0, wide=0, N=40; for(let i=0;i<N;i++){ d.monsters.length=0; d.px=400; d.py=270; __t.ensureEquip(d.hero).maoD=__t.mkItem(k); d.weapon='melee'; d.mouse={x:700,y:270};
          const a=__t.spawnDungeonMonster(); a.x=440; a.y=270; a.hp=a.maxHp=999; a.st='idle'; const c=__t.spawnDungeonMonster(); c.x=420; c.y=305; c.hp=c.maxHp=999; c.st='idle';
          d.combo=0; d.comboT=0; d.cd=0; __t.swingBasic(); tot+=999-a.hp; if(a.stun) st++; if(a.bleed||a.bleedT||a.bl) bl++; if(c.hp<999) wide++; }
          return [k, +(tot/N).toFixed(1), st, bl, wide];}""", k)
        print(r)
    print(J(pg,"Object.keys(__t.dungeon.monsters[0]).join(',')"))
    print(errs[:4]); b.close()
