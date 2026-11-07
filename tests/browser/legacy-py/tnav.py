import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(500)
    print("nav", J("JSON.stringify({ready:__t.NAV.ready,w:__t.NAV.w,h:__t.NAV.h,comps:__t.NAV.compSize.length,main:__t.NAV.compSize[__t.NAV.mainComp],shore:__t.NAV.shore.length, big:__t.NAV.compSize.filter(n=>n>50).length})"))
    # timing A* across main comp
    print("astar", J("""(()=>{const N=__t.NAV;const pts=[];for(let k=0;k<N.w*N.h;k+=97) if(!N.blocked[k]&&N.comp[k]===N.mainComp) pts.push(k);
      let t0=performance.now(),ok=0,n=0,longest=0;for(let i=0;i<40;i++){const a=pts[Math.floor(Math.random()*pts.length)],b=pts[Math.floor(Math.random()*pts.length)];
      const r=__t.findPath(N.ox+(a%N.w)*N.step,N.oy+((a/N.w)|0)*N.step,N.ox+(b%N.w)*N.step,N.oy+((b/N.w)|0)*N.step,Infinity); n++; if(r){ok++; longest=Math.max(longest,r.len)}}
      return JSON.stringify({ms_per:(performance.now()-t0)/n, ok, n, longest:Math.round(longest)})})()"""))
    # count animals in water before/after sim
    J("window.__inW=()=>__t.world.animals.filter(a=>a.alive&&__t.isWaterCell(a.x,a.y)).length")
    print("animals", J("__t.world.animals.filter(a=>a.alive).length"), "inWater", J("__inW()"))
    t=J("(()=>{const t0=performance.now(); for(let i=0;i<600;i++) __t.simTick(__t.CONFIG.TICK_MIN); return (performance.now()-t0)/600})()")
    print("ms per simTick", round(t,3), "inWater", J("__inW()"), "alive", J("__t.world.animals.filter(a=>a.alive).length"), "navActive", J("__t.world.animals.filter(a=>a.navActive).length"), "blocked", J("__t.world.animals.filter(a=>a.navBlocked).length"))
    # cross-water check: find animal, target on another comp
    print("crossTest", J("""(()=>{const N=__t.NAV;let a=__t.world.animals.find(x=>x.alive);const ca=__t.compAt(a.x,a.y);
      let k=-1;for(let i=0;i<N.w*N.h;i+=13){ if(!N.blocked[i]&&N.comp[i]!==ca&&N.compSize[N.comp[i]]>30){k=i;break}} if(k<0) return 'no other comp';
      const tx=N.ox+(k%N.w)*N.step,ty=N.oy+((k/N.w)|0)*N.step; a.nav=null; const d=__t.moveStep(a,tx,ty,3,1,true); return 'ret '+d+' blocked '+a.navBlocked+' state '+a.state})()"""))
    # detour test: find pair same comp with water between
    print("detour", J("""(()=>{const N=__t.NAV;const pts=[];for(let k=0;k<N.w*N.h;k+=37) if(!N.blocked[k]&&N.comp[k]===N.mainComp) pts.push(k);
      for(let t=0;t<500;t++){const a=pts[Math.floor(Math.random()*pts.length)],b=pts[Math.floor(Math.random()*pts.length)];const ax=N.ox+(a%N.w)*N.step,ay=N.oy+((a/N.w)|0)*N.step,bx=N.ox+(b%N.w)*N.step,by=N.oy+((b/N.w)|0)*N.step;
        const st=Math.hypot(bx-ax,by-ay); if(st<40||st>150||__t.losClear(ax,ay,bx,by)) continue;
        const o={x:ax,y:ay,dir:0,energy:100,species:'deer'}; let wet=0,steps=0,d=1e9; while(steps<600&&d>1){d=__t.moveStep(o,bx,by,2,1,true,Infinity); if(__t.isWaterCell(o.x,o.y)) wet++; steps++}
        return JSON.stringify({straight:Math.round(st),steps,wet,arrived:d<=1, ptsN:o.nav&&o.nav.pts.length})}
      return 'none'})()"""))
    # hero walk across
    print(errs[:3]); b.close()
