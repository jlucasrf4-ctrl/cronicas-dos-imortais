import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(800)
    for k in ["rock","tree","fish"]:
        J(f"__t.startMinigame(__h,'{k}')"); pg.wait_for_timeout(700)
        a=J("document.getElementById('mg-mark').style.left"); pg.wait_for_timeout(300); b2=J("document.getElementById('mg-mark').style.left")
        for i in range(8): pg.keyboard.press("Space"); pg.wait_for_timeout(250)
        print(k, "mark moves", a!=b2, "modal open", J("document.getElementById('mg-modal').classList.contains('open')"), J("document.getElementById('mg-log').innerText.slice(0,80)"))
        J("document.getElementById('mg-modal').classList.remove('open')"); pg.wait_for_timeout(300)
    J("__t.econ.test=true"); print("test forge have", J("__t.forgeHave(__h,'ferro')"), "folhama", J("__t.runeCount(__h,'folhama')"))
    J("__t.econ.test=false"); J("__t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    pg.keyboard.press("k"); pg.wait_for_timeout(800); pg.screenshot(path="s_k2.png"); print("sheet visible", J("(()=>{const m=document.getElementById('sheet-modal'); const r=m.getBoundingClientRect(); return getComputedStyle(m).display+' '+r.width})()"))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
    J("(()=>{const e=__t.ensureEquip(__t.dungeon.hero); e.maoD=__t.mkItem('eq_lanca'); e.maoD.q=3; __t.eqDurInit(e.maoD); window.__af=JSON.stringify(e.maoD.af); __t.toggleInv(); })()"); pg.wait_for_timeout(700)
    pg.screenshot(path="s_inveq.png")
    J("__t.dEqTake('maoD', true)"); pg.wait_for_timeout(300)
    print("dropped", J("JSON.stringify(__t.dungeon.loot.filter(l=>l.key==='eq_lanca').map(l=>[!!l.it, l.it&&l.it.q]))"), "hand", J("!!__t.ensureEquip(__t.dungeon.hero).maoD"))
    J("__t.toggleInv()"); J("(()=>{const l=__t.dungeon.loot.find(l=>l.key==='eq_lanca'); __t.collectLoot(l);})()")
    print("picked", J("(()=>{const it=__t.ensureInv(__t.dungeon.hero).items.find(i=>i.def.key==='eq_lanca'); return it? JSON.stringify([it.q, JSON.stringify(it.af)===__af]):'none'})()"))
    print(errs[:5]); b.close()
