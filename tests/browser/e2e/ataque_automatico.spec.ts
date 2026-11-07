import { test, expect, entrarComHeroi, campoDireto } from "./comum.ts";

test("clique repete básicos no foco; pausa, alcance, especial e Esc são respeitados", async ({ jogo }) => {
  test.skip(jogo.referencia, "controle novo da v8.1");
  test.setTimeout(180000);
  expect(await jogo.js("__t.OPT.ataqueAutomatico")).toBe(false);
  await jogo.js(`__t.openTitle(); document.querySelector('[data-act="options"]').click();
    document.querySelector('[data-sw="ataqueAutomatico"]').click();
    document.querySelector('#mv-opts [data-back]').click();`);
  expect(await jogo.js("__t.OPT.ataqueAutomatico")).toBe(true);
  expect(await jogo.js("JSON.parse(localStorage.getItem('cdi.opts.v1')).ataqueAutomatico")).toBe(true);
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  const resultado = await jogo.js<{
    passos: number[];
    ritmo: boolean;
    pausa: boolean;
    longe: boolean;
    especial: boolean;
    esc: boolean;
    clava: boolean;
    manual: boolean;
    desligou: boolean;
  }>(`(()=>{
    const t=__t, d=t.dungeon;
    t.D3.on=false; t.D3.gl=false;
    d.flow='x'; d.banner=null; d.modalOpen=false; d.invOpen=false; d.craftOpen=false;
    d.training=true; d.weapon='melee'; d.guard=false; d.monsters=[]; d.birds=[];
    t.ensureEquip(d.hero).maoD=t.mkItem('eq_espada');
    const m={x:460,y:300,alive:true,hp:10000,hpMax:10000,st:'idle',dummy:true,kind:'wolf'};
    const outro={...m,x:700}; d.monsters=[m,outro]; d.target=outro;
    const cv=document.getElementById('dungeon-canvas'), r=cv.getBoundingClientRect();
    const evento=(tipo,button,x,y)=>cv.dispatchEvent(new PointerEvent(tipo,{
      button,pointerId:1,bubbles:true,clientX:r.left+x*r.width/(d.cols*d.tile),
      clientY:r.top+y*r.height/(d.rows*d.tile)
    }));
    const pronto=()=>{d.px=440;d.py=300;d.cd=0;d.autoCd=0;d.hitStop=0;d.parryVis=0;d.noAtk=0;d.down=0;d.mouseC=null;};
    pronto(); evento('pointerdown',0,m.x,m.y); evento('pointerup',0,m.x,m.y);
    const passos=[];
    for(let i=0;i<3;i++){pronto();d.mouse={x:100,y:100};t.renderDungeonFrame(.016);passos.push(d.lastStep);}
    // ritmo: depois de um básico, o próximo espera 1/ATAQUE_AUTO.porSeg s mesmo sem recarga do golpe
    const ritmo0=d.autoCd, passo0=d.lastStepAt; d.cd=0; d.parryVis=0;
    t.renderDungeonFrame(.016); const ritmo=ritmo0>0 && d.lastStepAt===passo0;
    pronto(); d.invOpen=true; const hp=m.hp; t.renderDungeonFrame(.016);
    const pausa=m.hp===hp && d.cd===0; d.invOpen=false;
    pronto(); m.x=700; t.renderDungeonFrame(.016); const longe=m.hp===hp && d.cd===0; m.x=460;
    pronto(); evento('pointerdown',2,m.x,m.y); const hp2=m.hp;
    t.renderDungeonFrame(.016); const especial=d.especialPressionado && m.hp===hp2 && d.cd===0 && d.parryVis>0;
    evento('pointerup',2,m.x,m.y);
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',bubbles:true}));
    pronto();t.renderDungeonFrame(.016);const esc=!d.alvoAutomatico && m.hp===hp2 && d.cd===0;
    t.ensureEquip(d.hero).maoD=t.mkItem('eq_clava');
    pronto(); evento('pointerdown',0,m.x,m.y);t.renderDungeonFrame(.016);
    evento('pointerup',0,m.x,m.y);const clava=d.hv?.kind==='clubL';
    evento('pointerdown',2,m.x,m.y);
    const troca=d.hv?.kind==='clubR';evento('pointerup',2,m.x,m.y);
    t.OPT.d3=false;
    document.querySelector('[data-sw="ataqueAutomatico"]').click();
    const desligou=!t.OPT.ataqueAutomatico && !d.alvoAutomatico && !d.hv;
    t.ensureEquip(d.hero).maoD=t.mkItem('eq_espada');
    pronto();evento('pointerdown',0,m.x,m.y);evento('pointerup',0,m.x,m.y);
    const golpe=d.cd>0 && !!d.slash;pronto();d.slash=null;t.renderDungeonFrame(.016);
    const manual=golpe && !d.slash && d.cd===0 && !d.alvoAutomatico;
    return {passos,ritmo,pausa,longe,especial,esc,clava:clava&&troca,manual,desligou};
  })()`);
  expect(resultado).toEqual({
    passos: [0, 1, 2],
    ritmo: true,
    pausa: true,
    longe: true,
    especial: true,
    esc: true,
    clava: true,
    manual: true,
    desligou: true,
  });
});
