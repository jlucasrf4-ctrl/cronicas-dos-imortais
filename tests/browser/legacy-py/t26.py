import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":800})
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(2500)
    r=pg.evaluate("""(()=>{const w=__t.world; __t.econ.test=true; const h=__t.createHero('A',__t.bornFromSeed(5)); 
      const refs=new Map(); const ents=new Set([...w.animals,...w.veg,...w.heroes,...w.carcasses]);
      const scan=(o,path,depth)=>{ if(!o||typeof o!=='object'||depth>3) return; for(const k in o){ const v=o[k]; if(v&&typeof v==='object'){ if(ents.has(v)) refs.set(path+'.'+k,(refs.get(path+'.'+k)||0)+1); else if(!(v instanceof Array && v.length>50)) scan(v,path+'.'+k,depth+1);} } };
      for(const a of w.animals) scan(a,'animal',0); for(const hh of w.heroes) scan(hh,'hero',0); for(const v of w.veg) scan(v,'veg',0);
      const sizes={}; for(const k in w){ try{ sizes[k]=JSON.stringify(w[k]).length }catch(e){ sizes[k]='ERR '+e.message } }
      return {refs:[...refs], sizes, animalKeys:Object.keys(w.animals[0]), vegKeys:Object.keys(w.veg[0]||{}), econKeys:Object.keys(__t.econ), dKeys: Object.keys(h)}})()""")
    print(json.dumps(r,indent=0)[:4000]); b.close()
