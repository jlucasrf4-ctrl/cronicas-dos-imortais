import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":860})
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(2000)
    J(pg,"""(()=>{__t.econ.test=true; const h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.launchDungeon(h.id)})()""")
    pg.wait_for_timeout(2600)
    J(pg,"""(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.px=300; d.py=280;})()""")
    box=pg.locator("#dungeon-canvas").bounding_box()
    pg.mouse.move(box['x']+box['width']*0.5, box['y']+box['height']*0.2)
    # anda para a direita com o mouse parado: o herói deve continuar olhando para o mouse, sem girar
    pg.keyboard.down("KeyD"); ys=[]
    for i in range(12): pg.wait_for_timeout(120); ys.append(J(pg,"[+__t.GL3.hyaw.toFixed(2), +Math.atan2(__t.dungeon.mouse.y-__t.dungeon.py, __t.dungeon.mouse.x-__t.dungeon.px).toFixed(2)]"))
    pg.keyboard.up("KeyD"); print("yaw vs mouse:", ys)
    # defesa: lobo morde de frente com escudo erguido
    r=J(pg,"""(()=>{const d=__t.dungeon; d.mouse=null; d.mouseC=null; d.px=400; d.py=300; d.target=null; const m=__t.spawnDungeonMonster({}); m.x=430; m.y=300; d.mouse={x:500,y:300};
       d.guard=true; d.gstam=100; const hp0=d.hp; m.st='windup'; m.atk='bite'; m.t=0.0001; m.ang=Math.PI; __t.updateDungeonMonster(m,0.016); return [hp0, d.hp, d.gstam, m.st]})()""")
    print("bloqueio mordida:", r)
    pg.keyboard.down("Space"); pg.wait_for_timeout(50)
    r=J(pg,"""(()=>{const d=__t.dungeon; const m=d.monsters[0]; m.st='chase'; m.x=420; m.y=300; __t.shieldWall(); return [d.guard, +(m.x-d.px).toFixed(1)]})()""")
    print("muro do escudo (dist min):", r)
    r=J(pg,"""(()=>{const d=__t.dungeon; const m=d.monsters[0]; const hp0=d.hp; m.x=520; m.y=300; m.st='leap'; m.lx=380; m.ly=300; m.l0=140; m.lt=0; m.hit=false; m.lpr=null;
       for(let i=0;i<40;i++){__t.updateDungeonMonster(m,0.016); __t.shieldWall();} return [hp0,d.hp,+m.x.toFixed(1),m.st]})()""")
    print("bote no escudo:", r)
    pg.keyboard.up("Space"); pg.wait_for_timeout(300)
    J(pg,"__t.dungeon.monsters.length=0; __t.setBanner('🐺 Horda 2','teste',3)"); pg.wait_for_timeout(300); pg.screenshot(path="g_banner.png")
    J(pg,"__t.dungeon.banner=null")
    print(errs[:4]); b.close()
