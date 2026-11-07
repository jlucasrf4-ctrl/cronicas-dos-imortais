import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}, device_scale_factor=2); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.econ.introDone=true; __t.econ.campTut=3; __h.state='field'; __t.CAMPO_VIDA.loboChance=0;"); pg.wait_for_timeout(500)
    J("__t.jogoEnter()"); pg.wait_for_timeout(5000)
    print("mode", J("__t.dungeon.mode"), "ground", J("JSON.stringify(__t.dungeon.loot.filter(l=>l.ground).reduce((a,l)=>(a[l.key]=(a[l.key]||0)+1,a),{}))"))
    # parade: coelho, cervo M, cervo F, pássaro pousado perto do jogador
    J("""(()=>{const d=__t.dungeon,T=d.tile; d.monsters=d.monsters.filter(m=>!m.critter); d.px=d.cols*T/2; d.py=d.rows*T/2;
      const r=__t.critSpawn('rabbit'); r.x=d.px+40; r.y=d.py+20; r.ang=Math.PI; r.tgt=null; r.t=99; r.st='graze';
      const a=__t.critSpawn('deer'); a.sex='M'; a.x=d.px+110; a.y=d.py-10; a.ang=Math.PI*0.9; a.tgt=null; a.t=99; a.st='wander';
      const f=__t.critSpawn('deer'); f.sex='F'; f.x=d.px+110; f.y=d.py+60; f.ang=Math.PI*1.1; f.tgt=null; f.t=99; f.st='graze';
      for (const k of __t.CRIT_SP?[]:[]) {}
      d.birds.forEach((b,i)=>{b.x=d.px-60-i*20; b.y=d.py+30; b.tx=b.x+1; b.ty=b.y; b.st='idle'; b.t=99; b.flyT=99;});
      __t.CAMPO_VIDA.perto=0; __t.CRIT_SP.rabbit.scare=0; __t.CRIT_SP.deer.scare=0; __t.AVE.susto=0;})()""")
    pg.wait_for_timeout(800)
    box=J("(()=>{const r=document.getElementById('dungeon-canvas').getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]})()")
    pg.screenshot(path="z70_a.png", clip={"x":box[0]-120,"y":box[1]-140,"width":380,"height":260})
    # walk deer to see legs
    J("(()=>{const d=__t.dungeon; for (const m of d.monsters) if (m.critter) { m.tgt={x:m.x-200,y:m.y}; m.st='wander'; m.t=99; } })()"); pg.wait_for_timeout(500)
    pg.screenshot(path="z70_b.png", clip={"x":box[0]+150,"y":box[1]-140,"width":240,"height":230})
    # birds: walk near -> fly + feather
    n0=J("__t.dungeon.loot.filter(l=>l.key==='pena').length")
    J("(()=>{const d=__t.dungeon; __t.AVE.susto=2.4; for (const b of d.birds) {b.flyT=99;} d.px=d.birds[0].x+20; d.py=d.birds[0].y; })()"); pg.wait_for_timeout(500)
    print("birds", J("JSON.stringify(__t.dungeon.birds.map(b=>[b.st,Math.round(b.alt||0)]))"), "penas +", J("__t.dungeon.loot.filter(l=>l.key==='pena').length")-n0)
    pg.screenshot(path="z70_c.png", clip={"x":box[0]-300,"y":box[1]-250,"width":600,"height":420})
    pg.wait_for_timeout(5000); print("birds later", J("JSON.stringify(__t.dungeon.birds.map(b=>[b.st,Math.round(b.alt||0)]))"))
    print("errs", errs[:3]); b.close()
