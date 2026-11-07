import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
from PIL import Image
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]); pg=b.new_page(viewport={"width":1366,"height":860}); J=pg.evaluate; errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(3500)
    J("__t.enterGame(); window.__h=__t.createHero('A',__t.bornFromSeed(1));"); pg.wait_for_timeout(800)
    J("__t.openPrep(__h.id)"); pg.wait_for_timeout(500); J("document.getElementById('prep-go').click()"); pg.wait_for_timeout(3500)
    J("const d=__t.dungeon; d.flow='x'; d.monsters.length=0; d.loot.length=0; const e=__t.ensureEquip(d.hero); const it=__t.mkItem('eq_lanca'); __t.eqDurInit(it); e.maoD=it; __t.GL3.heroKey=''; d.px=420; d.py=270; d.mouse={x:700,y:300}")
    pg.wait_for_timeout(800)
    shots=[]
    for t in [0.0,0.04,0.08,0.14,0.22]:
        J(f"__t.GL3.fz={t}; const d=__t.dungeon; d.cd=0; d.parryVis=0; if({t}===0) __t.swingBasic(); d.px=420; d.py=270;"); pg.wait_for_timeout(500)
        pg.screenshot(path=f"thr_{t}.png"); shots.append(f"thr_{t}.png")
    J("__t.GL3.fz=null; __t.dungeon.shove=0.15"); 
    J("__t.dungeon.shove=0.15; __t.GL3.fz=null"); pg.wait_for_timeout(30); pg.screenshot(path="thr_shove.png"); shots.append("thr_shove.png")
    print(J("JSON.stringify(__t.dungeon.monsters.length)"), errs[:3]); b.close()
ims=[Image.open(BUILD_DIR + '/'+s) for s in shots]
# find hero region roughly: crop center area
W=Image.new('RGB',(300*len(ims),260))
for i,im in enumerate(ims): W.paste(im.crop((300,250,600,510)),(300*i,0))
W.save(BUILD_DIR + '/thr_sheet.png')
