import { test, expect, entrarComHeroi, campoDireto } from "./comum.ts";

test("stamina: Ginga, puxada do arco, corte vazio e impacto único", async ({ jogo }) => {
  test.skip(jogo.referencia, "reformulação da stamina");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  const r = await jogo.js<{
    ginga: number[];
    vazia: boolean;
    arco: number[];
    corte: boolean;
    antes: number[];
    impacto: number[];
    repetido: number[];
    falhou: number[];
  }>(`(()=>{
    const t=__t, d=t.dungeon, e=t.ensureEquip(d.hero);
    t.D3.on=false;t.D3.gl=false;
    d.flow='x';d.banner=null;d.monsters=[];d.birds=[];
    d.invOpen=d.modalOpen=d.craftOpen=d.dead=false;d.down=0;d.crav=null;
    d.guard=false;d.weapon='melee';d.cd=0;d.dodgeCd=0;d.dodge=null;
    e.maoE=null;e.maoD=t.mkItem('eq_faca');
    d.gstam=20;d.gint=100;t.espacoCorpo();
    const ginga=[d.gstam,d.gint,d.down];d.dodge=null;d.dodgeCd=0;t.espacoCorpo();
    const vazia=!d.dodge && d.gint===80;
    d.gstam=2;d.gint=100;d.weapon='bow';d.charge=0.1;d.charging=true;d.full=0;d.gregen=1;
    d.keys={};d.hitStop=0;t.renderDungeonFrame(0.1);
    const arco=[d.gstam,d.gint];
    d.charging=false;d.weapon='melee';e.maoD=t.mkItem('eq_machado');
    d.mode='campo';d.origem={x:0,y:0};d.training=false;d.camp=false;d.vila=false;
    d.px=400;d.py=300;d.mouseC=null;d.mouse={x:450,y:300};d.cd=0;d.hv=null;
    const id='teste-stamina-arvore';
    d.recursosCampo=[{id,bloco:'teste-stamina',tipo:'arvore',x:440,z:300,porte:'large',raio:10,maxHp:100}];
    t.world.recursosCampo ||= {};delete t.world.recursosCampo[id];
    d.gstam=1;d.gint=100;
    t.hvStart('axe');t.armasTick(1.0);const corte=!!d.hv && d.gstam===0 && d.gint===80;
    t.hvRelease('R');d.gstam=2;
    const antes=[d.gstam,d.gint,t.world.recursosCampo[id]?.hp??100];
    t.armasTick(0.19);
    const impacto=[d.gstam,d.gint,t.world.recursosCampo[id]?.hp??100];
    t.armasTick(0.1);
    const repetido=[d.gstam,d.gint,t.world.recursosCampo[id]?.hp??100];
    // Um golpe que perde o alcance antes do contato não custa impacto nem coleta.
    d.cd=0;d.gstam=100;d.gint=100;t.hvStart('axe');t.armasTick(.2);t.hvRelease('R');
    d.px=700;d.gstam=2;const hp=t.world.recursosCampo[id]?.hp??100;t.armasTick(.2);
    const falhou=[d.gstam,d.gint,(t.world.recursosCampo[id]?.hp??100)-hp];
    d.origem=null;d.recursosCampo=[];
    return {ginga,vazia,arco,corte,antes,impacto,repetido,falhou};
  })()`);
  expect(r.ginga).toEqual([0, 80, 0]);
  expect(r.vazia).toBe(true);
  expect(r.arco).toEqual([0, 80]);
  expect(r.corte).toBe(true);
  expect(r.antes).toEqual([2, 80, 100]);
  expect(r.impacto.slice(0, 2)).toEqual([0, 60]);
  expect(r.impacto[2]).toBeLessThan(100);
  expect(r.repetido).toEqual(r.impacto);
  expect(r.falhou).toEqual([2, 100, 0]);
});

test("inimigo: fuga final afasta, colapsa e levanta sem queda consecutiva", async ({ jogo }) => {
  test.skip(jogo.referencia, "reformulação da stamina");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  const r = await jogo.js<{ afastou: boolean; caiu: boolean; levantou: boolean; hp: number; reserva: number }>(`(()=>{
    const t=__t,d=t.dungeon;d.flow='x';d.monsters=[];d.birds=[];d.target=null;
    d.px=300;d.py=300;t.spawnDungeonMonster();const m=d.monsters[0];
    m.x=400;m.y=300;m.folMax=m.fol=100;m.folLost=0;m.folT=0;m.hp=m.hpMax=100;
    const sorteio=Math.random;Math.random=()=>.99;
    try {
      for(let i=0;i<4;i++){m.fol=100;t.folDrain(m,100);}
      const x0=m.x;t.updateDungeonMonster(m,.1);const afastou=m.x>x0;
      for(let i=0;i<31;i++)t.updateDungeonMonster(m,.1);
      const caiu=m.ko>0 && m.fugaFolego===0;
      m.ko=.01;t.updateDungeonMonster(m,.02);
      const levantou=m.ko===0 && m.protecaoFolego>0 && !m.desespero;
      Math.random=()=>0;t.folDrain(m,100);
      return {afastou,caiu,levantou:levantou && m.ko===0,hp:m.hp,reserva:1-m.quebrasFolego*.25};
    }finally{Math.random=sorteio;}
  })()`);
  expect(r).toMatchObject({ afastou: true, caiu: true, levantou: true, hp: 100 });
  expect(r.reserva).toBeLessThanOrEqual(0);
});

test("corrida: reserva zero mantém o movimento e reduz a velocidade suavemente", async ({ jogo }) => {
  test.skip(jogo.referencia, "curva de corrida pela reserva");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  const r = await jogo.js<{ primeiro: number; ultimo: number; corre: boolean; moveu: boolean }>(`(()=>{
    const t=__t,d=t.dungeon;t.D3.on=false;t.D3.gl=false;
    d.flow='x';d.monsters=[];d.birds=[];d.origem=null;d.mount=null;
    d.invOpen=d.modalOpen=d.craftOpen=false;d.guard=d.charging=false;d.hv=null;
    d.hitStop=0;d.down=0;d.guardBroken=0;d.runLock=false;d.gstam=100;d.gint=0;d.gregen=1;
    d.fatorCorrida=1;d.keys={KeyD:true,ShiftLeft:true};d.px=400;d.py=300;
    t.renderDungeonFrame(.05);const primeiro=d.fatorCorrida;
    for(let i=0;i<9;i++)t.renderDungeonFrame(.05);
    const r={primeiro,ultimo:d.fatorCorrida,corre:d.running,moveu:d.px>400};d.keys={};return r;
  })()`);
  expect(r.corre).toBe(true);
  expect(r.moveu).toBe(true);
  expect(r.primeiro).toBeGreaterThan(r.ultimo);
  expect(r.primeiro).toBeLessThan(1);
  expect(r.ultimo).toBeGreaterThanOrEqual(0.65);
});
