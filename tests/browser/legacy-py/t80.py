import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.on("console",lambda m: m.type=="error" and errs.append("C:"+m.text))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J(pg,"__t.enterGame(); __t.econ.test=true; window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));"); pg.wait_for_timeout(800)
    r=J(pg,"""(()=>{const h=__h, L=__t.runeList(); const r=__t.runeNew(h.camp.x+70,h.camp.y+10,'fogo'); L.push(r); window.__r=r;
      const a=__t.world.animals.find(a=>a.alive&&a.species==='rabbit'); a.x=r.x; a.y=r.y; for(let i=0;i<40;i++) __t.simTick(1);
      return {runes:L.length, runic:a.runic, str:r.str, ev:__t.world.events.slice(-3).map(e=>e.text||e)}})()""")
    print("map:",r)
    J(pg,"""(()=>{const c=__t.camera,r=__r, vp=document.getElementById('viewport'); c.scale=6; c.tx=vp.clientWidth/2-r.x*c.scale; c.ty=vp.clientHeight/2-r.y*c.scale; c.zt=null; __t.applyCameraTransform(); __t.openRuneInspector(r);})()""")
    pg.wait_for_timeout(900); pg.screenshot(path="r_map.png")
    J(pg,"(()=>{const c=__t.camera; c.scale=0.9; const r=__r, vp=document.getElementById('viewport'); c.tx=vp.clientWidth/2-r.x*c.scale; c.ty=vp.clientHeight/2-r.y*c.scale; __t.applyCameraTransform();})()"); pg.wait_for_timeout(500); pg.screenshot(path="r_map_far.png")
    r=J(pg,"""(()=>{const h=__h, inv=__t.ensureInv(h); __t.tryAddToInv(inv,'ametista'); __t.tryAddToInv(inv,'pedra'); h._folhKit=1; __t.tryAddToInv(inv,'folhama');__t.tryAddToInv(inv,'folhama');
      __t.runeSend(__r); let n=0; while(h.state==='traveling' && n++<3000) __t.simTick(1); return [h.state, n, __t.runeCount(h,'folhama'), JSON.stringify(__t.runeSubsOf(h))]})()""")
    print("send:",r)
    J(pg,"__t.runeAbsorbOpen({hero:__h,rune:__r,where:'mapa'})"); pg.wait_for_timeout(600); pg.screenshot(path="r_ab0.png")
    J(pg,"__t.raAct('start'); __t.RA.holding=true"); pg.wait_for_timeout(700); pg.screenshot(path="r_ab_heat.png"); pg.wait_for_timeout(1200)
    print("after heat:",J(pg,"[__t.RA.step,__t.runeCount(__h,'folhama')]"))
    J(pg,"(()=>{const P=__t.runePattern(__r.seed); __t.RA.sketch=P.map(s=>s.map(p=>[p[0]+0.03,p[1]-0.02])); __t.raAct('skdone')})()"); pg.wait_for_timeout(300); pg.screenshot(path="r_ab_subs.png")
    J(pg,"(()=>{__t.RA.sel=['ametista','pedra']; __t.raAct('seal')})()"); pg.wait_for_timeout(300)
    J(pg,"(()=>{const P=__t.runePattern(__r.seed); __t.RA.trace=P.map(s=>s.map(p=>[p[0]+0.02,p[1]+0.01]));})()"); pg.wait_for_timeout(400); pg.screenshot(path="r_ab_trace.png")
    J(pg,"__t.raAct('tracedone')"); pg.wait_for_timeout(1300); pg.screenshot(path="r_ab_fix.png"); pg.wait_for_timeout(1800); pg.screenshot(path="r_ab_res.png")
    print("res:",J(pg,"JSON.stringify(__t.RA.res)"))
    J(pg,"__t.raAct('take')"); pg.wait_for_timeout(300)
    print("inv:",J(pg,"__t.ensureInv(__h).items.map(i=>i.def.key+'×'+(i.n||1)).join(',')"), J(pg,"[__h.state, __t.runeList().length, JSON.stringify(__h.runeLore)]"))
    print(errs[:6]); b.close()
