import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":860})
    pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(2200)
    pg.evaluate("(()=>{__t.econ.test=true; const h=__t.createHero('Ayla',__t.bornFromSeed(12345)); h.treeBonus=4; __t.econ.quiver.n=10; __t.launchDungeon(h.id)})()"); pg.wait_for_timeout(2600)
    print(pg.evaluate("(()=>{const d=__t.dungeon; return {T:d.tile,px:d.px,py:d.py,safe:__t.dSafe()}})()"))
    # sair da zona segura e criar um lobo perto
    pg.evaluate("(()=>{const d=__t.dungeon; d.px=d.tile*12; d.py=d.tile*6; d.invuln=999; d.monsters.forEach(x=>x.alive=false); __t.spawnDungeonMonster(); const m=d.monsters.find(x=>x.alive); m.x=d.px+d.tile*3; m.y=d.py; m.hp=m.hpMax=999; window.__m=m;})()")
    samples=[]
    for i in range(30):
        pg.wait_for_timeout(450)
        samples.append(pg.evaluate("(()=>{const d=__t.dungeon,m=window.__m; return [m.st+(m.atk?'/'+m.atk:''),Math.round(Math.hypot(m.x-d.px,m.y-d.py)/d.tile*10)/10,Math.round(Math.atan2(m.y-d.py,m.x-d.px)*57.3)]})()"))
    print(samples)
    pg.screenshot(path="wolf.png")
    # bloqueio + parry com nós
    pg.evaluate("(()=>{const h=__t.dungeon.hero; for(const id of ['guarda_firme','parry_atordoante','corte_sangrento']) __t.buyNode(h,id); const d=__t.dungeon; d.invuln=0; d.hp=d.hpMax; d.weapon='melee'; d.guard=true; d.mouse={x:d.px+50,y:d.py}; const m=d.monsters.find(x=>x.alive); m.x=d.px+16; m.y=d.py; m.st='chase'; window.__r=__t.wolfStrike(m,null,4,0.5); window.__slow=m.slow; })()")
    print(pg.evaluate("({slow:window.__slow})"))
    pg.evaluate("(()=>{const d=__t.dungeon; d.guard=false; const m=d.monsters.find(x=>x.alive); m.slow=0; m.x=d.px+16; m.y=d.py; m.st='windup'; m.atk='bite'; m.wuTot=m.t=0.1; m.parry=null; d.mouse={x:d.px+60,y:d.py}; __t.doParry(); window.__st={st:m.st,stun:m.stun,bleed:!!m.bleed,rip:d.riposte}})()")
    print(pg.evaluate("window.__st"))
    pg.wait_for_timeout(500); pg.screenshot(path="parry.png")
    pg.evaluate("(()=>{const h=__t.dungeon.hero; __t.addHeroXp(h,2000); })()"); pg.wait_for_timeout(300)
    print(pg.evaluate("(()=>{const h=__t.dungeon.hero; return {lvl:h.lvl,pts:__t.treePoints(h)}})()"))
    pg.screenshot(path="lvl.png")
    print("ERRS",errs[:6])
    b.close()
