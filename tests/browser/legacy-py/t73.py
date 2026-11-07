import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(4500)
    def setup(key):
        J("""(k=>{const d=__t.dungeon,T=d.tile; d.monsters.length=0; d.px=d.cols*T/2; d.py=d.rows*T/2; d.cd=0; d.crav=null; d.weapon='melee'; d.spearOut=null;
          const e=__t.ensureEquip(__h); const it=__t.mkItem(k); __t.eqDurInit(it); e.maoD=it;
          window.__ws=[0,1,2].map(i=>{const w=__t.trainWolf(); const a=[0,-0.35,0.35][i]; w.x=d.px+Math.cos(a)*30+(k==='eq_faca'?i*5:0); w.y=d.py+Math.sin(a)*30; w.hp=w.hpMax=200; w.st='idle'; w.cravCd=99; return w;});
          d.target=__ws[2]; d.mouse={x:d.px+100,y:d.py}; })('"""+key+"')")
    hp=lambda: J("__ws.map(w=>+(w.hpMax-w.hp).toFixed(1))")
    setup("eq_faca"); print("knifeMode", J("__t.knifeMode()"))
    J("__t.swingBasic()"); pg.wait_for_timeout(100); print("faca esquerdo (dano por lobo, [2]=marcado):", hp())
    setup("eq_faca"); J("__t.doParry()"); pg.wait_for_timeout(100); print("faca direito (estocada):", hp(), "parryVis", J("__t.dungeon.parryVis||0"))
    import statistics
    def avg(n):
        tot=[]
        for _ in range(12):
            setup("eq_espada"); J("(n=>{const d=__t.dungeon; d.target=null; d.monsters=__ws.slice(0,n); d.combo=0; d.comboT=0;})(%d)"%n); J("__t.swingBasic()"); pg.wait_for_timeout(30)
            tot.append(sum(hp()[:n])/n)
        return round(statistics.mean(tot),2)
    print("espada: dano médio por alvo 1 alvo", avg(1), "| 2 alvos", avg(2), "| 3 alvos", avg(3))
    print("errs", errs[:3]); b.close()
