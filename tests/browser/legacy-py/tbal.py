import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1000,"height":700}); J=pg.evaluate
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1)); __t.ensureInv(__h).cols=60; __t.ensureInv(__h).rows=60; __t.econ.stash.cols=90; __t.econ.stash.rows=90;")
    print("attrs", J("JSON.stringify(__h.attrs)"))
    cnt="(()=>{const o={}; for(const inv of [__t.ensureInv(__h),__t.econ.stash,__h.qv||{items:[]}]) for(const i of inv.items){const k=i.def.key+(i.tier?'_'+['A','A+','SS'][i.tier]:''); o[k]=(o[k]||0)+(i.n||1);} for(const k in __h.loot) if(__h.loot[k]) o['loot_'+k]=__h.loot[k]; return o})()"
    res={}
    for tg in ['rabbit','deer','boar','duck','eagle','tree','rock']:
        tot=0; hours=0; diffs={}
        for run in range(2):
            J("__h.x=__h.camp.x; __h.y=__h.camp.y; __h.state='idle'; __h.task=null; __h.energy=100; __h.hunger=0; __h.mgUntil=0;")
            before=J(cnt)
            J(f"__h.huntSpecies='{tg}'; __h.huntHours=12; __t.huntHere(__h)"); pg.wait_for_timeout(150)
            J("(()=>{const a=[...document.querySelectorAll('#wm-modal button')].find(b=>/sozinho/i.test(b.textContent)); a&&a.click()})()")
            mk=0
            for i in range(16):
                J("document.getElementById('ff-hour').click()"); pg.wait_for_timeout(120)
                k=J("__h.task?__h.task.killsDone:-1"); mk=max(mk,k)
                if J("__h.state")!='hunting' and J("__h.state")!='traveling' and i>2: break
            after=J(cnt)
            for k in set(before)|set(after):
                d=after.get(k,0)-before.get(k,0)
                if d: diffs[k]=diffs.get(k,0)+d
            tot+=mk; hours+=12
        res[tg]=(tot,hours,diffs); print(tg, "abates/12h:", tot/2, diffs)
    b.close()
