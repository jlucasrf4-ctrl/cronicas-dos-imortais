/* v8.0 — os personagens vestidos no esqueleto da heroína (render/gl/vestidos.ts; mantenedor, 2026-10-25: "se eu
   apertar E nele meu boneco passa a ter a aparência dele"). Na sala de treino eles ficam em fila como manequins; o E
   perto de um veste a heroína com ele, o E no mesmo volta a ser ela, e a aparência fica ao sair da sala. */
import { test, expect, entrarComHeroi, campoDireto } from "./comum.ts";

test("sala de treino: os manequins dos personagens, E veste e desveste", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem os personagens vestidos");
  test.setTimeout(150_000);
  await entrarComHeroi(jogo, "Ayla", 777);
  // como no jogo de hoje: ela anda pelo mapa (não está livre na base) — antes a entrada era recusada
  await jogo.js("__t.OPT.autoRes=false; __h.state='field'; __t.updateHeroPanelUI()");
  expect(await jogo.js("!!document.querySelector('[data-act=\"dtest\"]')"), "botão com ela no mapa").toBe(true);
  await jogo.js("document.querySelector('[data-act=\"dtest\"]').click()");
  await jogo.esperar(3800);
  expect(await jogo.js("__t.dungeon.training")).toBeTruthy();
  await jogo.js("document.querySelector('[data-tr=\"min\"]').click()");
  const nomes = await jogo.js<string[]>(
    "__t.dungeon.monsters.filter(m=>m.model&&m.model.startsWith('vestido:')).map(m=>m.model.slice(8))",
  );
  expect(
    nomes.length,
    "os 31 manequins (10 + as 5 versões das deusas + o explorador + os 9 corpos do Tripo + as 6 femininas com a roupa por cima)",
  ).toBe(31);
  expect(nomes).toContain("deusa_outono_nova");
  expect(nomes).toContain("corpo_f01__aventureira");
  expect(nomes).not.toContain("corpo_f01__placa"); // malhas internas continuam disponíveis para a roupa equipada
  await jogo.foto("fila_manequins");

  // perto do samurai: o painel oferece vestir, o E veste
  const perto = (nome: string) =>
    `(()=>{const d=__t.dungeon, m=d.monsters.find(m=>m.model==='vestido:${nome}'); d.px=m.x; d.py=m.y-d.tile*0.6; d.moveTarget=null;})()`;
  await jogo.js(perto("samurai"));
  await jogo.esperar(400);
  expect(await jogo.js<string>("document.getElementById('acoes').textContent")).toContain("Samurai");
  await jogo.page.keyboard.press("KeyE");
  await jogo.esperar(600);
  expect(await jogo.js("__t.VESTIDO.atual")).toBe("samurai");
  await jogo.foto("vestido_samurai");

  // outro manequim troca direto; E no mesmo volta à heroína
  await jogo.js(perto("cavaleiro_1"));
  await jogo.esperar(300);
  await jogo.page.keyboard.press("KeyE");
  await jogo.esperar(400);
  expect(await jogo.js("__t.VESTIDO.atual")).toBe("cavaleiro_1");
  await jogo.foto("vestido_cavaleiro");
  expect(await jogo.js<string>("document.getElementById('acoes').textContent")).toContain("Voltar a ser a heroína");
  await jogo.page.keyboard.press("KeyE");
  await jogo.esperar(300);
  expect(await jogo.js("__t.VESTIDO.atual")).toBeNull();

  // HEROINA no GameShark também tira
  await jogo.js(perto("lider_bandidos"));
  await jogo.esperar(300);
  await jogo.page.keyboard.press("KeyE");
  await jogo.esperar(300);
  expect(await jogo.js("__t.VESTIDO.atual")).toBe("lider_bandidos");
  await jogo.js("__t.gsRun('HEROINA')");
  expect(await jogo.js("__t.VESTIDO.atual")).toBeNull();

  // as deusas pelo GameShark (o mesmo código de novo volta à heroína)
  for (const [cod, nome] of [
    ["PRIMAVERA", "deusa_primavera"],
    ["VERAO", "deusa_verao"],
    ["OUTONO", "deusa_outono"],
    ["INVERNO", "deusa_inverno"],
  ]) {
    await jogo.js(`__t.gsRun('${cod}')`);
    await jogo.esperar(400);
    expect(await jogo.js("__t.VESTIDO.atual")).toBe(nome);
    // a roupa vale só para quem a vestiu (os personagens criados depois mantêm a aparência sorteada)
    expect(await jogo.js("__t.VESTIDO.heroi === __t.dungeon.hero.id")).toBe(true);
    await jogo.foto("deusa_" + cod.toLowerCase());
  }
  await jogo.js("__t.gsRun('INVERNO')");
  expect(await jogo.js("__t.VESTIDO.atual")).toBeNull();

  // de dentro de outro campo (o acampamento), o TREINO fecha ele e entra na sala
  await jogo.js("__t.exitDungeon(()=>{})");
  await jogo.esperar(500);
  await jogo.js("__t.enterCamp(__h)");
  await jogo.esperar(3000);
  expect(await jogo.js("__t.dungeon.active && __t.dungeon.camp"), "no acampamento").toBeTruthy();
  await jogo.js("__t.gsRun('TREINO')");
  await jogo.esperar(3500);
  expect(await jogo.js("__t.dungeon.active && __t.dungeon.training"), "do acampamento para a sala").toBeTruthy();
  expect(jogo.erros, "sem erros no console").toEqual([]);
});

test("deusa do Outono (modelo novo): a caminhada no campo", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem o modelo novo");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.loot.length=0; d.px=441; d.py=273; d.mouseC=null; d.mouse={x:541,y:343}; __t.D3.ZM=3.2; __t.vestir('deusa_outono_nova', __h.id); __t.GL3.heroKey=''; window.dispatchEvent(new Event('resize'));})()",
  );
  await jogo.esperar(1200);
  expect(await jogo.js("__t.VESTIDO.atual")).toBe("deusa_outono_nova");
  await jogo.foto("parada");
  await jogo.page.keyboard.down("d");
  await jogo.esperar(500);
  expect(await jogo.js("__t.heroinaEstado()"), "entra no clip de caminhada").toBe("andar");
  await jogo.foto("andando");
  await jogo.page.keyboard.down("Shift");
  await jogo.esperar(500);
  expect(await jogo.js("__t.heroinaEstado()"), "entra no clip de corrida").toBe("correr");
  await jogo.foto("correndo_modelo_novo");
  await jogo.page.keyboard.up("Shift");
  await jogo.esperar(450);
  expect(await jogo.js("__t.heroinaEstado()"), "volta a andar após correr").toBe("andar");
  await jogo.js("__t.vestir('samurai', __h.id); __t.GL3.heroKey=''");
  await jogo.esperar(350);
  await jogo.page.keyboard.down("Shift");
  await jogo.esperar(400);
  expect(await jogo.js("__t.heroinaEstado()"), "o Samurai também entra na corrida").toBe("correr");
  await jogo.foto("correndo_samurai");
  await jogo.page.keyboard.up("Shift");
  await jogo.esperar(450);
  expect(await jogo.js("__t.heroinaEstado()"), "o Samurai volta a andar após correr").toBe("andar");
  await jogo.page.keyboard.up("d");
  await jogo.js("__t.vestir('deusa_outono', __h.id); __t.GL3.heroKey=''");
  await jogo.esperar(600);
  await jogo.page.keyboard.down("d");
  await jogo.esperar(500);
  await jogo.foto("andando_outono_atual");
  await jogo.page.keyboard.up("d");
  expect(jogo.erros, "sem erros no console").toEqual([]);
});

/* v8.1 — a roupa por cima do corpo (tools/vestir-roupa.ts): corpo do Tripo + roupa do manequim, a frente pintada com
   a imagem do GPT (textura) e o corpo e as costas com cor por triângulo (mantenedor, 2026-11-01: "precisa de um
   talento na pintura das roupas e na colocação delas") */
test("roupa por cima do corpo: a aventureira com a textura, parada e andando", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem as roupas");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  await jogo.js(
    "(()=>{const d=__t.dungeon; d.flow='x'; d.banner=null; d.monsters.length=0; d.birds.length=0; d.loot.length=0; d.px=441; d.py=273; d.mouseC=null; d.mouse={x:441,y:400}; __t.D3.ZM=3.2; window.dispatchEvent(new Event('resize'));})()",
  );
  for (const nome of ["corpo_f02__aventureira", "corpo_f06__aventureira"]) {
    await jogo.js(`__t.vestir('${nome}', __h.id); __t.GL3.heroKey=''`);
    await jogo.esperar(1200);
    expect(await jogo.js("__t.VESTIDO.atual")).toBe(nome);
    await jogo.foto(nome + "_parada");
    await jogo.page.keyboard.down("d");
    await jogo.esperar(500);
    expect(await jogo.js("__t.heroinaEstado()"), "entra no clip de caminhada").toBe("andar");
    await jogo.foto(nome + "_andando");
    await jogo.page.keyboard.up("d");
    await jogo.esperar(400);
    const coletou = await jogo.js<boolean>(
      "(()=>{const d=__t.dungeon; d.loot.push({key:'galho',tier:0,t:0,ttl:0,x:d.px+6,y:d.py}); const n=d.loot.length; __t.interact(); return d.loot.length<n;})()",
    );
    expect(coletou, "a roupa continua vestida ao pegar um item").toBe(true);
    await jogo.esperar(250);
    await jogo.foto(nome + "_coletando");
    await jogo.esperar(800);
  }
  expect(jogo.erros, "sem erros no console").toEqual([]);
});

test("roupas equipadas preservam o corpo e desenham torso, calça e botas separados", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem as roupas por cima do corpo");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  const sorteio = await jogo.js<{
    chamadas: number;
    peito: string;
    pernas: string;
    pes: string;
    manteveCorpo: boolean;
  }>(`(()=>{
    const id=__h.id;
    __t.openPrep(id);
    const h=__t.world.heroes.find(x=>x.id===id);
    window.__roupaHero=h;
    h.visual={corpo:'corpo_f04',cabeca:'propria'};
    h.equip.peito=__t.mkItem('eq_armadura');
    h.equip.pernas=__t.mkItem('eq_calca');
    h.equip.pes=__t.mkItem('eq_botas');
    let chamadas=0;
    const aleatorio=Math.random;
    try {
      Math.random=()=>{chamadas++;return 0.8};
      __t.vestirComoHeroi(h.visual,h.id,h.equip);
      const roupa=h.equip.peito.visualRoupa;
      Math.random=()=>{throw new Error('sorteou novamente durante o desenho')};
      __t.vestirComoHeroi(h.visual,h.id,h.equip);
      return {chamadas,peito:roupa,pernas:h.equip.pernas.visualRoupa,pes:h.equip.pes.visualRoupa,manteveCorpo:h.visual.corpo==='corpo_f04'&&h.visual.cabeca==='propria'};
    } finally { Math.random=aleatorio; }
  })()`);
  expect(sorteio).toEqual({
    chamadas: 1,
    peito: "patrulheira",
    pernas: "patrulheira",
    pes: "patrulheira",
    manteveCorpo: true,
  });

  const persistencia = await jogo.js<{ semPeito: string[]; aoReequipar: string[] }>(`(()=>{
    const h=window.__roupaHero, peito=h.equip.peito;
    h.equip.peito=null;
    __t.vestirComoHeroi(h.visual,h.id,h.equip);
    const semPeito=[h.equip.pernas.visualRoupa,h.equip.pes.visualRoupa];
    h.equip.peito=peito;
    __t.vestirComoHeroi(h.visual,h.id,h.equip);
    return {semPeito,aoReequipar:[h.equip.pernas.visualRoupa,h.equip.pes.visualRoupa]};
  })()`);
  expect(persistencia).toEqual({
    semPeito: ["patrulheira", "patrulheira"],
    aoReequipar: ["patrulheira", "patrulheira"],
  });

  const grupos = await jogo.js<number[]>(`(()=>{
    const h=window.__roupaHero;
    __t.openPrep(h.id); __t.renderPrep();
    const porMatriz=new Map();
    for(const item of __t.GL3.list){const grupo=porMatriz.get(item.M)||[];grupo.push(item.mesh.n);porMatriz.set(item.M,grupo)}
    return [...porMatriz.values()].map(grupo=>grupo.length);
  })()`);
  await jogo.esperar(1200);
  await jogo.foto("preview_corpo_proprio_com_roupa");
  expect(grupos, "corpo-base + calça + botas + torso na mesma pose").toContain(4);
  expect(await jogo.js("__roupaHero.visual.cabeca==='propria' && __roupaHero.visual.corpo==='corpo_f04'")).toBe(true);
  const gruposLider = await jogo.js<number[]>(`(()=>{
    __roupaHero.visual={...__roupaHero.visual,corpo:'lider'}; __t.renderPrep();
    const porMatriz=new Map();
    for(const item of __t.GL3.list){const grupo=porMatriz.get(item.M)||[];grupo.push(item.mesh.n);porMatriz.set(item.M,grupo)}
    return [...porMatriz.values()].map(grupo=>grupo.length);
  })()`);
  await jogo.esperar(500);
  await jogo.foto("preview_lider_com_roupa");
  expect(gruposLider, "corpo da Líder preservado com as três peças sobre ele").toContain(4);
  await jogo.js("__roupaHero.visual={...__roupaHero.visual,corpo:'corpo_f04'}; __t.renderPrep()");
  const cota = await jogo.js<{ peito: string; pernas: string; pes: string; grupos: number[] }>(`(()=>{
    const h=window.__roupaHero;
    h.equip.peito=__t.mkItem('eq_cota');
    __t.vestirComoHeroi(h.visual,h.id,h.equip);
    __t.renderPrep();
    const porMatriz=new Map();
    for(const item of __t.GL3.list){const grupo=porMatriz.get(item.M)||[];grupo.push(item.mesh.n);porMatriz.set(item.M,grupo)}
    return {peito:h.equip.peito.visualRoupa,pernas:h.equip.pernas.visualRoupa,pes:h.equip.pes.visualRoupa,grupos:[...porMatriz.values()].map(grupo=>grupo.length)};
  })()`);
  expect(cota, "cota pesada aparece e mantém as outras peças alinhadas").toMatchObject({
    peito: "placa",
    pernas: "placa",
    pes: "placa",
  });
  await jogo.esperar(500);
  await jogo.foto("preview_cota_com_as_pecas");
  expect(cota.grupos, "cota também desenha as três peças sobre o corpo").toContain(4);
  await jogo.js("__t.closePrep(); __t.closeTitle(); __t.launchDungeon(__roupaHero.id)");
  await jogo.esperar(2600);
  await jogo.esperar(1000);
  await jogo.foto("campo_corpo_proprio_com_roupa");
  const gruposCampo = await jogo.js<number[]>(`(()=>{
    const porMatriz=new Map();
    for(const item of __t.GL3.list){const grupo=porMatriz.get(item.M)||[];grupo.push(item.mesh.n);porMatriz.set(item.M,grupo)}
    return [...porMatriz.values()].map(grupo=>grupo.length);
  })()`);
  expect(gruposCampo, "corpo-base + calça + botas + torso na mesma pose no campo").toContain(4);
  expect(await jogo.js("__roupaHero.visual.cabeca==='propria' && __roupaHero.visual.corpo==='corpo_f04'")).toBe(true);
  expect(jogo.erros, "sem erros no console").toEqual([]);
});

test("sala de treino: novo manequim do Outono veste com E", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem o modelo novo");
  await entrarComHeroi(jogo, "Ayla", 777);
  await jogo.js("__t.OPT.autoRes=false; __h.state='field'; __t.updateHeroPanelUI()");
  await jogo.js("document.querySelector('[data-act=\"dtest\"]').click()");
  await jogo.esperar(3800);
  await jogo.js("document.querySelector('[data-tr=\"min\"]').click()");
  const nomes = await jogo.js<string[]>(
    "__t.dungeon.monsters.filter(m=>m.model&&m.model.startsWith('vestido:')).map(m=>m.model.slice(8))",
  );
  expect(nomes).toContain("deusa_outono_nova");
  await jogo.foto("fila_manequim_novo");
  await jogo.js(
    "(()=>{const d=__t.dungeon, m=d.monsters.find(m=>m.model==='vestido:deusa_outono_nova'); d.px=m.x; d.py=m.y-d.tile*0.6; d.moveTarget=null;})()",
  );
  await jogo.esperar(400);
  await jogo.page.keyboard.press("KeyE");
  await jogo.esperar(400);
  expect(await jogo.js("__t.VESTIDO.atual")).toBe("deusa_outono_nova");
  await jogo.foto("vestir_modelo_novo");
  expect(jogo.erros, "sem erros no console").toEqual([]);
});
