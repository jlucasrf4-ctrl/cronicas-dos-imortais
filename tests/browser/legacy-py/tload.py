import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
import sys,time
from playwright.sync_api import sync_playwright
f=sys.argv[1] if len(sys.argv)>1 else "vtest.html"
with sync_playwright() as p:
    b=p.chromium.launch(); res=[]
    for i in range(3):
        pg=b.new_page(viewport={"width":1366,"height":860}); t0=time.time(); pg.goto(BUILD_URL + ""+f, wait_until="load"); t1=time.time()
        res.append(round((t1-t0)*1000)); 
        if i==2: print("nav->load ms", res, "domContentLoaded", pg.evaluate("Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd)"))
        pg.close()
    b.close()
