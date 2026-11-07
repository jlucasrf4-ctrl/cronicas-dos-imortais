import pathlib; ROOT = pathlib.Path(__file__).resolve().parents[3]; BUILD_DIR = str(ROOT / "dist"); BUILD_URL = (ROOT / "dist").as_uri() + "/"  # caminhos do projeto
from playwright.sync_api import sync_playwright
errs=[]
def J(pg,code): return pg.evaluate(code)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":860})
    pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(BUILD_URL + "vtest.html"); pg.wait_for_timeout(2000)
    J(pg,"window.__h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.updateHeroPanelUI()")
    # escolha minigame/automatico
    J(pg,"__t.askWork(window.__h,'rock',()=>{window.__auto=1})"); pg.wait_for_timeout(200); pg.screenshot(path="wm.png")
    print("modal open",J(pg,"document.getElementById('wm-modal').classList.contains('open')"), "play disabled:",J(pg,"document.getElementById('wm-play').disabled"))
    pg.click("#wm-auto"); print("auto called",J(pg,"window.__auto"))
    J(pg,"__t.askWork(window.__h,'rock',()=>{window.__auto=2})"); pg.click("#wm-play"); pg.wait_for_timeout(300)
    print("mg open",J(pg,"document.getElementById('mg-modal').classList.contains('open')"))
    for i in range(6):
        pg.wait_for_timeout(250); pg.keyboard.press("Space")
    pg.wait_for_timeout(200); pg.screenshot(path="mg.png")
    print("result",J(pg,"document.getElementById('mg-info').innerText"), "stone:",J(pg,"__t.resCount(window.__h,'stone')"),"cd:",J(pg,"window.__h.mgUntil-__t.world.tick"))
    pg.click("#mg-hit"); print("closed",J(pg,"!document.getElementById('mg-modal').classList.contains('open')"))
    # descanso: botão desabilitado
    J(pg,"__t.askWork(window.__h,'tree',()=>{})"); print("tree play disabled (cooldown):",J(pg,"document.getElementById('wm-play').disabled"), J(pg,"document.getElementById('wm-note').textContent.slice(0,60)")); pg.click("#wm-cancel")
    # pesca: spot
    print("fish spot near water:",J(pg,"(()=>{const w=__t.world.waterPoints[0]; return !!__t.fishSpot(w.x+5,w.y)})()"), "far:",J(pg,"!!__t.fishSpot(-500,-500)"))
    # tarefa automatica via modal para ervas? kind rabbit => direto
    J(pg,"(()=>{window.__x=0; __t.askWork(window.__h,'rabbit',()=>{window.__x=1})})()"); print("rabbit direct",J(pg,"window.__x"))
    # chest
    J(pg,"document.getElementById('btn-chest').click()"); pg.wait_for_timeout(300); pg.screenshot(path="chest.png")
    print("ERRS",errs[:6]); b.close()
