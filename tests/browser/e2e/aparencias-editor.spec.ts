/* v8.1 — o controle de qualidade das aparências no Modo Editor (src/editor/aparencias_qc.ts): o painel 👤 Aparências
   abre, "Ver todas" põe as combinações em fila no chão, ✘ marca a combinação (grava em ED.dados.aparencias),
   "Vestir a heroína" troca a aparência dela e ↺ volta. */
import { test, expect, entrarComHeroi, esperarAte } from "./comum.ts";

test("criação — sorteia todas as cabeças e corpos femininos, incluindo heroína e líder", async ({ jogo }) => {
  test.skip(jogo.referencia, "o sorteio completo foi restaurado na versão atual");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  const r = await jogo.js<{ corpos: string[]; cabecas: number; maior: number; proprias: number }>(`(()=>{
    const anterior=Math.random, corpos=new Set(), cabecas=new Map();
    const bn=__t.bornFromSeed(777); let seed=17;
    Math.random=()=>((seed=seed*16807%2147483647)-1)/2147483646;
    try {
      for(let i=0;i<1000;i++) {
        const h=__t.createHero('Sorteio '+i,bn), a=h.visual;
        if(h.aparenciaVersao!==1) throw Error('personagem novo sem aparência persistente');
        if(a.corpo.startsWith('corpo_m') || a.cabeca.startsWith('homem_')) throw Error('aparência masculina sorteada');
        corpos.add(a.corpo); cabecas.set(a.cabeca,(cabecas.get(a.cabeca)||0)+1);
        __t.world.heroes.pop();
      }
    } finally { Math.random=anterior; }
    return {corpos:[...corpos],cabecas:cabecas.size,maior:Math.max(...cabecas.values())/1000,proprias:cabecas.get('propria')||0};
  })()`);
  expect(r.corpos).toContain("heroina");
  expect(r.corpos).toContain("lider");
  expect(r.corpos).toHaveLength(13);
  expect(r.cabecas).toBe(29);
  expect(r.maior).toBeLessThan(0.07);
  expect(r.proprias).toBeGreaterThan(0);
});

test("Modo Editor: aparências — ver todas, marcar ruim, vestir e voltar", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem o editor");
  test.setTimeout(240000);
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await jogo.js(
    // meio-dia: à noite um bando de bandidos pode chegar e o aviso tapa o editor
    "(()=>{const w=__t.world; w.tick=Math.floor(w.tick/1440)*1440+720; __t.closeTitle(); __t.econ.introDone=true; __t.econ.campTut=3; __t.CAMPO_VIDA.loboChance=0; const h=__h; h.state='idle'; h.task=null; __t.JOGO.pending=true; __t.JOGO.pos={x:h.x,y:h.y}; __t.launchDungeon(h.id, true);})()",
  );
  expect(await esperarAte(jogo, "__t.dungeon.active && !!__t.dungeon.origem", 5000)).toBe(true);
  await jogo.esperar(2500);
  const pg = jogo.page;
  await pg.keyboard.press("F2");
  await jogo.esperar(500);
  await pg.locator("#ed-ap-bt").click();
  await expect(pg.locator("#ed-ap")).toBeVisible();
  const n = await pg.locator("#ed-ap-lista button").count();
  expect(n, "corpos × cabeças").toBeGreaterThan(10);
  await pg.locator('#ed-ap [data-a="todas"]').click();
  await jogo.esperar(3000);
  await jogo.foto("ap1-todas");
  // fecha a fila (~190 figuras: no SwiftShader cada quadro pesa e o resto do teste estourava o tempo)
  await pg.locator('#ed-ap [data-a="todas"]').click();
  // a 2ª cabeça do 1º corpo: ✘
  await pg.locator('#ed-ap [data-a="h+"]').click();
  await pg.locator('#ed-ap [data-a="ruim"]').click();
  const notas = await jogo.js<Record<string, string>>("__t.ED.dados.aparencias");
  expect(Object.values(notas)).toEqual(["ruim"]);
  await expect(pg.locator("#ed-ap-lista button.ruim")).toHaveCount(1);
  // vestir e voltar
  await pg.locator('#ed-ap [data-a="vestir"]').click();
  expect(await jogo.js("JSON.stringify(__t.dungeon.hero.visual)")).toBe(
    JSON.stringify({ corpo: Object.keys(notas)[0].split("|")[0], cabeca: Object.keys(notas)[0].split("|")[1] }),
  );
  await jogo.esperar(800);
  await jogo.foto("ap2-vestida");
  await pg.locator('#ed-ap [data-a="original"]').click();
  expect(await jogo.js("__t.dungeon.hero.visual === undefined")).toBe(true);
});

test("Modo Editor: trocar aparência depois da prévia e restaurar por personagem", async ({ jogo }) => {
  test.skip(jogo.referencia, "a referência não tem o editor");
  test.setTimeout(150000);
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await jogo.js(
    "(()=>{const w=__t.world;w.tick=Math.floor(w.tick/1440)*1440+720;__t.closeTitle();__t.econ.introDone=true;__t.econ.campTut=3;__t.CAMPO_VIDA.loboChance=0;__h.state='idle';__h.task=null;__t.JOGO.pending=true;__t.JOGO.pos={x:__h.x,y:__h.y};__t.launchDungeon(__h.id,true)})()",
  );
  expect(await esperarAte(jogo, "__t.dungeon.active && !!__t.dungeon.origem", 5000)).toBe(true);
  await jogo.esperar(2500);
  const pg = jogo.page;
  await pg.keyboard.press("F2");
  await pg.locator("#ed-ap-bt").click();
  await pg.locator('#ed-ap [data-a="c+"]').click();
  // Cada personagem recupera a própria aparência, mesmo alternando com o painel aberto.
  await pg.locator('#ed-ap [data-a="h+"]').click();
  await pg.locator('#ed-ap [data-a="vestir"]').click();
  const vestida = await jogo.js("JSON.stringify(__h.visual)");
  expect(await jogo.js("__h.visual.cabeca")).not.toBe("propria");
  await jogo.esperar(1000);
  expect(await jogo.js("JSON.stringify(__h.visual)")).toBe(vestida);
  await jogo.js(
    "window.__outro={...__h,id:'qa-outro',visual:{corpo:'corpo_f02',cabeca:'propria'}};__t.dungeon.hero=__outro",
  );
  await pg.locator('#ed-ap [data-a="vestir"]').click();
  await pg.locator('#ed-ap [data-a="original"]').click();
  expect(await jogo.js("JSON.stringify(__outro.visual)")).toBe(
    JSON.stringify({ corpo: "corpo_f02", cabeca: "propria" }),
  );
  await jogo.js("__t.dungeon.hero=__h");
  await pg.locator('#ed-ap [data-a="original"]').click();
  expect(await jogo.js("__h.visual === undefined")).toBe(true);
  // A prévia de modelos toma o canvas compartilhado. Reabrir Aparências deve recuperá-lo.
  await pg.locator('#ed-ap [data-a="x"]').click();
  await jogo.js(
    "__t.gsRun('MODELOS');document.querySelector('#mt-zoom').value='2';document.querySelector('#mt-zoom').dispatchEvent(new Event('input'));document.querySelector('[data-mt=fechar]').click()",
  );
  await pg.locator("#ed-ap-bt").click();
  const sentinela = await jogo.js<string>(
    "(()=>{const c=document.querySelector('#ed-ap-palco');const ctx=c.getContext('2d');ctx.fillStyle='#ff00ff';ctx.fillRect(0,0,c.width,c.height);return c.toDataURL()})()",
  );
  await pg.locator('#ed-ap [data-a="c+"]').click();
  await expect
    .poll(() => jogo.js("document.querySelector('#ed-ap-palco').toDataURL()"), { timeout: 10000 })
    .not.toBe(sentinela);
});

// v8.1 — corpo masculino só com cabeça masculina (mantenedor 2026-11-01); as masculinas têm a textura do Tripo
test("Modo Editor: aparências — o corpo masculino passa só pelas cabeças masculinas", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem o editor");
  test.setTimeout(240000);
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await jogo.js(
    "(()=>{const w=__t.world; w.tick=Math.floor(w.tick/1440)*1440+720; __t.closeTitle(); __t.econ.introDone=true; __t.econ.campTut=3; __t.CAMPO_VIDA.loboChance=0; const h=__h; h.state='idle'; h.task=null; __t.JOGO.pending=true; __t.JOGO.pos={x:h.x,y:h.y}; __t.launchDungeon(h.id, true);})()",
  );
  expect(await esperarAte(jogo, "__t.dungeon.active && !!__t.dungeon.origem", 5000)).toBe(true);
  await jogo.esperar(2500);
  const pg = jogo.page;
  await pg.keyboard.press("F2");
  await jogo.esperar(500);
  await pg.locator("#ed-ap-bt").click();
  await expect(pg.locator("#ed-ap")).toBeVisible();
  for (let i = 0; i < 30 && (await pg.locator("#ed-ap-corpo").textContent()) !== "Musculoso (M06)"; i++)
    await pg.locator('#ed-ap [data-a="c+"]').click();
  expect(await pg.locator("#ed-ap-corpo").textContent()).toBe("Musculoso (M06)");
  const vistas = new Set<string>();
  for (let i = 0; i < 9; i++) {
    vistas.add((await pg.locator("#ed-ap-cab").textContent())!);
    await pg.locator('#ed-ap [data-a="h+"]').click();
  }
  expect([...vistas].sort()).toEqual(
    [
      "Própria do corpo",
      "Bagunçado de barba",
      "Espetado de barba",
      "Cabelo longo de barba",
      "Coque de barba",
      "Raspado de barba",
      "Careca",
    ].sort(),
  );
  for (let i = 0; i < 9 && (await pg.locator("#ed-ap-cab").textContent()) !== "Raspado de barba"; i++)
    await pg.locator('#ed-ap [data-a="h+"]').click();
  await pg.locator('#ed-ap [data-a="vestir"]').click();
  expect(await jogo.js("JSON.stringify(__t.dungeon.hero.visual)")).toBe(
    JSON.stringify({ corpo: "corpo_m06", cabeca: "homem_raspado" }),
  );
  await jogo.esperar(1500);
  await jogo.foto("ap3-m06-raspado");
});
