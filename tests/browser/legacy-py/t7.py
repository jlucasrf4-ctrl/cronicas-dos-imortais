import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
errs=[]
def J(pg,code): return pg.evaluate(code)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":860})
    pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(2000)
    J(pg,"(()=>{__t.econ.test=true; const h=__t.createHero('Ayla',__t.bornFromSeed(12345)); __t.econ.quiver.n=10; __t.launchDungeon(h.id)})()"); pg.wait_for_timeout(2600)
    J(pg,"(()=>{const d=__t.dungeon; d.px=d.tile*12; d.py=d.tile*6; d.invuln=0; d.weapon='melee'; d.monsters.forEach(x=>x.alive=false); __t.spawnDungeonMonster(); const m=d.monsters.find(x=>x.alive); m.hp=m.hpMax=999; m.dm=1; window.__m=m;})()")
    def setup(t, atk='bite'):
        J(pg,f"(()=>{{const d=__t.dungeon,m=window.__m; d.invuln=0; d.hp=d.hpMax; d.parryCd=0; d.parryVis=0; d.guard=false; d.mouse={{x:d.px+60,y:d.py}}; m.x=d.px+18; m.y=d.py; m.alive=true; m.slow=0; m.stun=0; m.st='windup'; m.atk='{atk}'; m.wuTot=m.t={t}; m.parry=null; m.locked=false; m.ang=Math.PI; window.__hp0=d.hp;}})()")
    def dmg(): return J(pg,"window.__hp0-__t.dungeon.hp")
    # perfeito
    setup(0.1); J(pg,"__t.doParry()"); print("perfect: stun",J(pg,"window.__m.stun>0"),"toast",J(pg,"__t.dungeon.toasts.map(t=>t.text).join('|')"))
    pg.wait_for_timeout(200); pg.screenshot(path="ruptura.png")
    # parcial (t=0.3): bate depois
    setup(0.3); J(pg,"__t.doParry()"); J(pg,"(()=>{const m=window.__m; m.t=0; __t.updateDungeonMonster(m,0.016)})()"); print("parcial dmg",dmg(),"(sem parry seria ~2-4)", J(pg,"__t.dungeon.toasts.slice(-3).map(t=>t.text).join('|')"))
    # sem parry
    setup(0.3); J(pg,"(()=>{const m=window.__m; m.t=0; __t.updateDungeonMonster(m,0.016)})()"); print("sem parry dmg",dmg())
    # tolerância: parry com lobo AINDA não em windup e golpe dentro de 0.25s
    setup(0.3); J(pg,"(()=>{const m=window.__m; m.st='chase'; m.x=__t.dungeon.px+300; __t.dungeon.parryCd=0})()"); J(pg,"__t.doParry()"); print("whiff cd",J(pg,"__t.dungeon.parryCd")); J(pg,"(()=>{const d=__t.dungeon,m=window.__m; d.parryCd=0; d.parryVis=0.2; d.parryArc={x:d.px,y:d.py,ang:0}; m.x=d.px+18; m.y=d.py; m.hp=m.hpMax; window.__hp0=d.hp})()")
    J(pg,"(()=>{const m=window.__m; m.st='windup'; m.atk='bite'; m.t=0; m.parry=null; m.ang=Math.PI; __t.updateDungeonMonster(m,0.016)})()"); print("tolerância dmg",dmg(), J(pg,"__t.dungeon.toasts.slice(-2).map(t=>t.text).join('|')"))
    # bote: parry durante windup do pounce com t<=0.45
    setup(0.25,'pounce'); J(pg,"__t.doParry()"); print("pounce parry kind",J(pg,"JSON.stringify(window.__m.parry)+' stun:'+(window.__m.stun>0)"))
    # vida baixa
    for i in range(10):
        J(pg,"(()=>{const d=__t.dungeon; const m=window.__m; m.alive=true;m.lowSet=false;m.low=null;m.fleeT=0;m.hp=m.hpMax; m.st='chase'; m.x=d.px+d.tile*3; m.y=d.py; d.invuln=99; d.hp=d.hpMax; m.hp=m.hpMax*0.2; __t.updateDungeonMonster(m,0.016); window.__lows=(window.__lows||[]); window.__lows.push(m.low)})()")
    print("low modes",J(pg,"window.__lows.join(',')"))
    # flee: simula
    J(pg,"(()=>{const d=__t.dungeon,m=window.__m; m.alive=true; m.lowSet=true; m.low='flee'; m.fleeT=4; m.st='chase'; m.x=d.px+d.tile*2; m.y=d.py; window.__d0=Math.hypot(m.x-d.px,m.y-d.py)})()")
    for i in range(60): J(pg,"__t.updateDungeonMonster(window.__m,0.05)")
    print("flee dist",J(pg,"Math.round(window.__d0)"),"->",J(pg,"Math.round(Math.hypot(window.__m.x-__t.dungeon.px,window.__m.y-__t.dungeon.py))"),"state",J(pg,"window.__m.st+'/'+window.__m.low+'/'+window.__m.fleeT"))
    # espada: HUD e partículas
    J(pg,"(()=>{const d=__t.dungeon,m=window.__m; d.invuln=99; m.alive=true; m.low=null; m.fleeT=0; m.hp=m.hpMax=999; m.st='chase'; m.x=d.px+30; m.y=d.py; d.mouse={x:d.px+100,y:d.py}; d.cd=0; d.parts.length=0; __t.swingBasic(); window.__np=d.parts.length})()")
    pg.wait_for_timeout(350)
    print("particles after sword hit:",J(pg,"window.__np"),"pts",J(pg,"JSON.stringify(__t.dungeon.hero.swordMastery)"),"hud:",J(pg,"document.getElementById('sw-pts').textContent+' '+document.getElementById('sw-fill').style.width"))
    pg.screenshot(path="sword.png")
    print("ERRS",errs[:6]); b.close()
