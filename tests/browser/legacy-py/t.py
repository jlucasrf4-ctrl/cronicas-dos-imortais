import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":860})
    pg.on("pageerror",lambda e:errs.append(str(e))); pg.on("console",lambda m: errs.append("C:"+m.text) if m.type=="error" else None)
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(2200)
    # criação por nascimento (UI real)
    pg.evaluate("__t.econ.test=true; __t.openCreateModal()")
    pg.fill("#create-name","Kaelin"); pg.click("#create-confirm"); pg.wait_for_timeout(8200)
    pg.screenshot(path="birth.png")
    h=pg.evaluate("(()=>{const h=__t.world.heroes[0]; return {aff:h.aff,gen:h.gen,attrs:h.attrs,tot:Object.values(h.attrs).reduce((a,b)=>a+b,0),hp:h.hpMax,lvl:h.lvl}})()")
    print(h)
    # distribuição: 300 sementes -> sempre 45, afinidades variadas, sem build 'ruim'
    st=pg.evaluate("(()=>{const c={},t=new Set(),mn=[];for(let i=1;i<=300;i++){const b=__t.bornFromSeed(i*7919);c[b.aff]=(c[b.aff]||0)+1;t.add(Object.values(b.attrs).reduce((a,x)=>a+x,0));mn.push(Math.min(...Object.values(b.attrs)),Math.max(...Object.values(b.attrs)));}return {c,totals:[...t],min:Math.min(...mn),max:Math.max(...mn)}})()")
    print(st)
    pg.click("#cr-skip"); pg.wait_for_timeout(300)
    # ficha
    pg.evaluate("(()=>{const h=__t.world.heroes[0]; h.treeBonus=3; __t.openSheet(h.id)})()"); pg.wait_for_timeout(300)
    pg.screenshot(path="sheet.png")
    print(pg.evaluate("(()=>{const h=__t.world.heroes[0]; const r=[];for(const id of ['parry_atordoante','guarda_firme','corte_sangrento']){r.push(!!__t.buyNode(h,id));} return {r,pts:__t.treePoints(h),nodes:Object.keys(h.nodes)}})()"))
    pg.evaluate("__t.sheet.tab='combate'; __t.renderSheet()"); pg.screenshot(path="sheet2.png")
    pg.evaluate("document.querySelector('[data-sheetclose]').click()")
    # masmorra
    pg.evaluate("(()=>{const h=__t.world.heroes[0]; __t.econ.quiver.n=10; __t.launchDungeon(h.id)})()"); pg.wait_for_timeout(2500)
    pg.evaluate("__t.spawnDungeonMonster()"); pg.wait_for_timeout(300)
    # hit no jogador + hud
    pg.evaluate("(()=>{const d=__t.dungeon; const m=d.monsters.find(x=>x.alive); m.x=d.px+14; m.y=d.py; __t.hurtPlayer(9, 0, m)})()"); pg.wait_for_timeout(120)
    pg.screenshot(path="hit.png")
    # sangramento 1-2-1-2
    print(pg.evaluate("""(()=>{const d=__t.dungeon; const m=d.monsters.find(x=>x.alive); m.hp=m.hpMax=500; __t.applyBleed(m,14); const out=[]; const orig=m.hp; for(let i=0;i<40&&m.bleed;i++){m.bleed.t=0; const b=m.hp; __t.updateDungeonMonster(m,0.001); out.push(+(b-m.hp).toFixed(2));} return {ticks:out, total:+(orig-m.hp).toFixed(2), secs:+(out.length*0.7).toFixed(1)}})()"""))
    # IA dos lobos: órbita
    d=pg.evaluate("""(()=>{const d=__t.dungeon; d.invuln=999; d.hp=d.hpMax; d.monsters.forEach(x=>x.alive=false); __t.spawnDungeonMonster(); const m=d.monsters.find(x=>x.alive); m.x=d.px+130; m.y=d.py; m.hp=m.hpMax=999; window.__m=m; return 1})()""")
    pg.wait_for_timeout(100)
    samples=[]
    for i in range(24):
        pg.wait_for_timeout(500)
        samples.append(pg.evaluate("(()=>{const d=__t.dungeon,m=window.__m; return [m.st,m.atk||'',Math.round(Math.hypot(m.x-d.px,m.y-d.py)),Math.round(Math.atan2(m.y-d.py,m.x-d.px)*57.3)]})()"))
    print(samples)
    print("ERRS",errs[:8])
    b.close()
