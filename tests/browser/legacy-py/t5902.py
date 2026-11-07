import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(800)
    # organizer in prep
    J("const inv=__t.ensureInv(__h); inv.items.length=0; for (const k of ['eq_lanca','pele','carne','eq_machado','gema','erva','presa','eq_clava','escudo']) { const it=__t.mkItem(k); __t.eqDurInit(it); __t.placeIn(inv,it); } __t.econ.gold=25;")
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(1000); pg.screenshot(path="s_org0.png")
    J("document.querySelector('.inv-org').click()"); pg.wait_for_timeout(500); print("gold after org", J("__t.econ.gold")); pg.screenshot(path="s_org1.png")
    # tooltip hover
    cell=pg.locator("#prep-card .inv-item .inv-cell").first if pg.locator("#prep-card .inv-item").count() else pg.locator(".inv-item .inv-cell").first
    bb=cell.bounding_box(); pg.mouse.move(bb["x"]+5,bb["y"]+5); pg.mouse.move(bb["x"]+7,bb["y"]+6); pg.wait_for_timeout(300); print("tip", J("getComputedStyle(document.getElementById('item-tip')).display"), J("document.getElementById('item-tip').textContent.slice(0,80)")); pg.screenshot(path="s_tip.png")
    pg.mouse.move(5,5)
    J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    # full bag pickup
    J("const d=__t.dungeon; d.flow='x'; d.monsters.length=0; const inv=__t.ensureInv(d.hero); let g=0; while(g++<200){ const it=__t.mkItem('pele'); if(!__t.placeIn(inv,it)) break; } d.loot.push({key:'reliquia',x:d.px+5,y:d.py,t:0,ttl:0,tier:0}); __t.interact()")
    pg.wait_for_timeout(600); print("inv opened on full", J("__t.dungeon.invOpen"), J("document.getElementById('inv-ground-hint').textContent.slice(0,40)")); pg.screenshot(path="s_full.png")
    J("__t.toggleInv(false); const inv=__t.ensureInv(__t.dungeon.hero); inv.items=inv.items.filter(i=>i.def.key!=='pele');")
    # fire: pedra minigame
    J("const inv=__t.ensureInv(__t.dungeon.hero); for (let i=0;i<4;i++){const g=__t.mkItem('galho'); __t.placeIn(inv,g);} const p=__t.mkItem('pedra'); p.n=3; __t.placeIn(inv,p); __t.fireOpen()"); pg.wait_for_timeout(500); pg.screenshot(path="s_fire0.png")
    J("__t.fireStart('pedra')"); pg.wait_for_timeout(400)
    for i in range(5): J("const g=__t.FIRE.mg; if(g){ g.pos=g.zc; g.anim=0; __t.fireKey('hit'); }"); pg.wait_for_timeout(250)
    pg.screenshot(path="s_fire1.png")
    print("fires", J("(__t.dungeon.fires||[]).length"), "lv", J("__t.econ.fireLv"))
    # friction
    J("const d=__t.dungeon; d.fires=[]; d.px+=200; __t.fireOpen(); __t.fireStart('galho')"); pg.wait_for_timeout(300)
    for i in range(30): J(f"__t.fireKey('{'L' if i%2==0 else 'R'}')"); pg.wait_for_timeout(180)
    pg.screenshot(path="s_fire2.png"); print("fires2", J("(__t.dungeon.fires||[]).length"), "lv", J("__t.econ.fireLv"), J("__t.FIRE.open"))
    J("__t.econ.fireLv=5; __t.dungeon.px-=300; __t.fireOpen(); __t.fireStart('pedra')"); pg.wait_for_timeout(200); print("auto fires", J("__t.dungeon.fires.length"))
    pg.wait_for_timeout(800); pg.screenshot(path="s_fire3d.png")
    # axe heavy
    J("const d=__t.dungeon; const e=__t.ensureEquip(d.hero); const it=__t.mkItem('eq_machado'); __t.eqDurInit(it); e.maoD=it; __t.GL3.heroKey=''; d.weapon='melee'; d.cd=0; d.gstam=100; __t.spawnDungeonMonster({}); const m=d.monsters[0]; m.x=d.px+35; m.y=d.py; m.hp=999; d.mouse={x:m.x,y:m.y}; __t.doParry()")
    pg.wait_for_timeout(900); print("axe hv", J("JSON.stringify(__t.dungeon.hv)"), J("Math.round(__t.dungeon.gstam)")); pg.screenshot(path="s_axe_ch.png")
    J("__t.hvRelease('R')"); pg.wait_for_timeout(100); print("crippled", J("+(__t.dungeon.monsters[0].cripple||0).toFixed(2)"))
    # club
    J("const d=__t.dungeon; const e=__t.ensureEquip(d.hero); const it=__t.mkItem('eq_clava'); __t.eqDurInit(it); e.maoD=it; __t.GL3.heroKey=''; d.cd=0; const m=d.monsters[0]; m.cripple=0; m.x=d.px+35; m.y=d.py; m.hp=999; m.st='chase'; window.__hp=m.hp; __t.swingBasic()")
    pg.wait_for_timeout(1100); print("club combo dmg", J("Math.round(__hp-__t.dungeon.monsters[0].hp)"))
    J("const d=__t.dungeon; d.cd=0; __t.doParry()"); pg.wait_for_timeout(500); J("__t.hvRelease('R')"); print("early release st", J("__t.dungeon.monsters[0].st"))
    J("const d=__t.dungeon; d.cd=0; const m=d.monsters[0]; m.x=d.px+35; m.y=d.py; __t.doParry()"); pg.wait_for_timeout(1700); J("window.__hp=__t.dungeon.monsters[0].hp; __t.hvRelease('R')"); print("smash", J("JSON.stringify({st:__t.dungeon.monsters[0].st, stun:+(__t.dungeon.monsters[0].stun||0).toFixed(1), dmg:Math.round(__hp-__t.dungeon.monsters[0].hp)})"))
    # boar telegraph
    J("const d=__t.dungeon; d.monsters.length=0; __t.spawnJavalino(2); const m=d.monsters.find(x=>x.kind==='javalino'); m.x=d.px+200; m.y=d.py; m.bcd=0; m.st='chase'; window.__b=m")
    pg.wait_for_timeout(700); print("boar", J("__b.st")); pg.screenshot(path="s_boar_aim.png")
    for i in range(30):
        if J("__b.st")=="charge": break
        pg.wait_for_timeout(100)
    pg.screenshot(path="s_boar_run.png"); print("boar2", J("__b.st"))
    print(errs[:5]); b.close()
