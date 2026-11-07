import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
def J(pg,c): return pg.evaluate(c)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J(pg,"__t.enterGame(); window.__h=__t.createHero('Ayla',__t.bornFromSeed(777));")
    J(pg,"(()=>{const st=__t.econ.stash; for(const k of ['ferro','ferro','ferro','ferro','ferro','galho','galho','pele','pele','pele','projeto_eq_espada']) __t.tryAddToInv(st,k);})()")
    J(pg,"__t.openForge()"); pg.wait_for_timeout(400); pg.screenshot(path="f_list.png")
    print("study:", J(pg,"(()=>{const st=__t.econ.stash; const it=st.items.find(i=>i.def.blueprint); return __t.forgeStudy(it,{inv:st})})()"))
    J(pg,"__t.openForge()"); pg.wait_for_timeout(300)
    J(pg,"__t.forgeStart('make','eq_espada')"); J(pg,"__t.FG.bel=true"); pg.wait_for_timeout(700); pg.screenshot(path="f_heat.png"); pg.wait_for_timeout(600)
    print("phase", J(pg,"[__t.FG.mg.ph, __t.FG.mg.T.toFixed(2)]"))
    for i in range(6):
        J(pg,"(()=>{const g=__t.FG.mg; g.pos=g.zc+0.01; __t.mgStrike();})()"); pg.wait_for_timeout(250)
        if i==2: pg.screenshot(path="f_hit.png")
    J(pg,"__t.FG.bel=false"); 
    print("phase2", J(pg,"[__t.FG.mg.ph, __t.FG.mg.T.toFixed(2), __t.FG.mg.hits.join(',')]"))
    J(pg,"(()=>{const g=__t.FG.mg; g.T=0.66; __t.mgQuench();})()"); pg.wait_for_timeout(300); pg.screenshot(path="f_done.png")
    J(pg,"__t.forgeFinish()"); print("made:", J(pg,"__t.econ.stash.items.concat(__t.ensureInv(__h).items).filter(i=>i.def.slot).map(i=>i.def.key+':q'+i.q+':'+i.dur+'/'+i.durMax).join(' ')"))
    # durabilidade na masmorra
    J(pg,"document.getElementById('fg-x').click(); __t.openPrep(__h.id)"); pg.wait_for_timeout(400)
    J(pg,"document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    r=J(pg,"""(()=>{const d=__t.dungeon; d.flow='x'; d.monsters.length=0; const m=__t.spawnDungeonMonster(); m.hp=m.hpMax=1e6; const e=__t.ensureEquip(__h); const s0=e.maoD.dur;
      for(let i=0;i<20;i++) __t.hurtMonster(m,1,'espada',0); const s1=e.maoD.dur; for(let i=0;i<200;i++) __t.hurtMonster(m,1,'espada',0);
      const ar0=e.peito.dur; d.guard=false; d.invuln=0; for(let i=0;i<30;i++){ d.hp=d.hpMax; __t.wolfStrike(m,null,3,0.5);} 
      return [s0,s1,!!e.maoD, ar0, e.peito&&e.peito.dur, e.cabeca&&e.cabeca.dur, __t.world.events.slice(-2).map(e=>e.text)]})()""")
    print("wear:", r); pg.wait_for_timeout(800); pg.screenshot(path="f_break.png")
    print(errs[:5]); b.close()
