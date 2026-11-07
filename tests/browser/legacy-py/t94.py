import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); __t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));")
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(1200)
    J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3000)
    for k in ["eq_espada","eq_lanca","eq_clava","eq_machado"]:
        print(J("""(k)=>{const d=__t.dungeon; d.flow='x'; let hits=0,tot=0,N=40,ms=0; for(let i=0;i<N;i++){ d.monsters.length=0; d.px=400; d.py=270; const it=__t.mkItem(k); __t.ensureEquip(d.hero).maoD=it; d.weapon='melee'; d.mouse={x:700,y:270};
          const a=__t.spawnDungeonMonster(); a.x=440; a.y=270; a.hp=999; a.st='idle'; a._yaw=null; d.combo=0; d.comboT=0; d.cd=0; ms+=__t.meleeDmg(d.hero); __t.swingBasic(); if(a.hp<999){hits++; tot+=999-a.hp;} }
          return [k, hits, +(tot/Math.max(1,hits)).toFixed(1), +(ms/N).toFixed(1)];}""", k))
    b.close()
