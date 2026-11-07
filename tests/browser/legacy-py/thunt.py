import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(500)
    print("btns", J("[...document.querySelectorAll('#hero-rows button[data-act]')].map(b=>b.dataset.act+':'+b.textContent.trim()).join(' | ')"))
    J("document.querySelector('[data-act=walk]').click()"); print("armed", J("__t.commandMode||null") if False else J("document.querySelector('[data-act=walk]').textContent"))
    J("(()=>{const r=__t.world.nodes.find(n=>n.kind==='rock'&&Math.hypot(n.x-__h.camp.x,n.y-__h.camp.y)>150); window.__rk=r; __t.walkClick(__h.id, r.x+20, r.y)})()")
    print("state", J("__h.state"), J("__h.walkTo"))
    for i in range(12):
        J("document.getElementById('ff-hour').click()"); pg.wait_for_timeout(150)
        if J("__h.state")=="field": break
    print("after walk", J("__h.state"), round(J("Math.hypot(__h.x-__h.camp.x,__h.y-__h.camp.y)")))
    J("__h.huntSpecies='rock'; __h.huntHours=4; __t.huntHere(__h)"); pg.wait_for_timeout(300)
    J("document.getElementById('wm-modal').classList.contains('open') && document.getElementById('wm-auto') && document.getElementById('wm-auto').click()")
    print("wm", J("[...document.querySelectorAll('#wm-modal button')].map(b=>b.id+':'+b.textContent.trim())"))
    J("(()=>{const bs=[...document.querySelectorAll('#wm-modal button')]; const a=bs.find(b=>/autom/i.test(b.textContent)); a&&a.click()})()")
    print("task", J("JSON.stringify(__h.task)"), J("__h.state"))
    print("rocks in area", J("__t.world.nodes.filter(n=>n.kind==='rock'&&Math.hypot(n.x-__h.task.x,n.y-__h.task.y)<__h.task.r).map(n=>[Math.round(Math.hypot(n.x-__h.task.x,n.y-__h.task.y)), n.readyAt>__t.world.tick?'notready':'ok'])"))
    J("document.getElementById('ff-hour').click()"); pg.wait_for_timeout(200)
    J("const s=__t.camera.minScale*7; __t.camera.scale=s; __t.camera.tx=683-__h.task.x*s; __t.camera.ty=430-__h.task.y*s;"); pg.wait_for_timeout(600); pg.screenshot(path="w_area.png")
    mx=0
    for i in range(8):
        J("document.getElementById('ff-hour').click()"); pg.wait_for_timeout(150)
        if __import__('json'): pass
        print(J("__h.state+' '+(__h.task&&__h.task.killsDone)+' tgt '+!!__h.targetEntity"))
        d=J("__h.task?Math.hypot(__h.x-__h.task.x,__h.y-__h.task.y):-1"); mx=max(mx,d)
    print("max dist from center", round(mx), "state", J("__h.state"), "stone", J("JSON.stringify(__h.loot)"), J("__t.ensureInv(__h).items.map(i=>i.def.key).join(',')"))
    pg.screenshot(path="w_hunt.png")
    J("__t.heroBack(__h)"); 
    for i in range(10):
        J("document.getElementById('ff-hour').click()"); pg.wait_for_timeout(120)
        if J("__h.state")=="idle": break
    print("back", J("__h.state"))
    for an in ['coelho','lobo','javali']:
        print(an, [len(J(f"__t.meatShape('{an}',{t})"))*10+len(J(f"__t.meatShape('{an}',{t})")[0]) for t in range(3)])
    print(errs[:3]); b.close()
