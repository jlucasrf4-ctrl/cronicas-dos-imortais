from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    for args in ([], ["--use-gl=swiftshader","--enable-unsafe-swiftshader"], ["--use-angle=swiftshader","--enable-unsafe-swiftshader"]):
        b=p.chromium.launch(args=args); pg=b.new_page()
        print(args, pg.evaluate("(()=>{const c=document.createElement('canvas');const g=c.getContext('webgl2')||c.getContext('webgl');if(!g)return 'none';const e=g.getExtension('WEBGL_debug_renderer_info');return (g instanceof WebGL2RenderingContext?'gl2 ':'gl1 ')+(e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):'')})()"))
        b.close()
