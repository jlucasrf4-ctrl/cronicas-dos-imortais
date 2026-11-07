/* 2026-11-06 — básico do arco no ataque automático e o anel de alcance enquanto segura Alt. Desde a v8.1 (mantenedor:
   "clica, barulhinho de puxar a corda, 3 segundos, atira"): o clique puxa a corda (ARCO_BASICO.puxada) mirando no alvo,
   solta 1 flecha quando enche, segura a corda se o alvo saiu do alcance e abaixa o arco no clique no chão. */
import { test, expect, entrarComHeroi, campoDireto } from "./comum.ts";

test("arco: clique no inimigo puxa a corda e solta sozinha ao alcance; Alt mostra o alcance", async ({ jogo }) => {
  test.skip(jogo.referencia, "controle novo de 2026-11-06");
  test.setTimeout(180000);
  await jogo.js("__t.OPT.ataqueAutomatico=true");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  const r = await jogo.js<{
    puxando: boolean;
    soltou: boolean;
    flechas: number;
    ritmo: boolean;
    segura: boolean;
    longe: boolean;
    parou: boolean;
    alt: boolean;
    solto: boolean;
  }>(`(()=>{
    const t=__t, d=t.dungeon, A=t.ARCO_BASICO, T=d.tile;
    t.D3.on=false; t.D3.gl=false;
    d.flow='x'; d.banner=null; d.modalOpen=false; d.invOpen=false; d.craftOpen=false;
    d.training=true; d.monsters=[]; d.birds=[];
    t.econ.test=false; t.econ.quiver.n=10;
    if(!t.ensureEquip(d.hero).costas) t.ensureEquip(d.hero).costas=t.mkItem('eq_arco');
    d.weapon='bow';
    const m={x:600,y:300,alive:true,hp:10000,hpMax:10000,st:'idle',dummy:true,kind:'wolf'};
    d.monsters=[m];
    const cv=document.getElementById('dungeon-canvas'), rc=cv.getBoundingClientRect();
    const evento=(tipo,x,y)=>cv.dispatchEvent(new PointerEvent(tipo,{button:0,pointerId:1,bubbles:true,
      clientX:rc.left+x*rc.width/(d.cols*T), clientY:rc.top+y*rc.height/(d.rows*T)}));
    d.px=600-T*(A.alcance-0.5); d.py=300; d.cd=0; d.autoCd=0; d.charging=false;
    evento('pointerdown',m.x,m.y); evento('pointerup',m.x,m.y);
    const n0=d.arrows.length; t.renderDungeonFrame(.016);
    // puxando: a corda começou a encher, nenhuma flecha saiu ainda
    const puxando=d.charging && d.tiroAuto && d.charge<0.1 && d.arrows.length===n0 && t.econ.quiver.n===10;
    d.charge=0.9999; t.renderDungeonFrame(.016);
    const soltou=d.arrows.length-n0===1 && !d.charging && d.cd>0, flechas=t.econ.quiver.n;
    // a próxima puxada começa depois da pausa, sem flecha nova na hora
    d.cd=0; t.renderDungeonFrame(.016); const ritmo=d.charging && d.tiroAuto && d.arrows.length-n0===1;
    // o alvo saiu do alcance com a corda cheia: ela segura, não atira
    d.px=600-T*(A.alcance+2); d.charge=0.9999; t.renderDungeonFrame(.016);
    const segura=d.charging && d.tiroAuto && d.arrows.length-n0===1;
    // longe sem estar puxando: não começa a puxar
    d.charging=false; d.tiroAuto=false; d.cd=0; t.renderDungeonFrame(.016);
    const longe=!d.charging && d.arrows.length-n0===1;
    // clique no chão durante a puxada: abaixa o arco
    d.px=600-T*(A.alcance-0.5); d.cd=0; t.renderDungeonFrame(.016);
    const comecou=d.charging && d.tiroAuto;
    evento('pointerdown',600-T*(A.alcance-0.5),300+T*3); evento('pointerup',600-T*(A.alcance-0.5),300+T*3);
    t.renderDungeonFrame(.016);
    const parou=comecou && !d.charging && !d.tiroAuto && !d.alvoAutomatico;
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'AltLeft',bubbles:true}));
    const a=t.anelAlcance(); const alt=!!a && Math.abs(a.basico-T*A.alcance)<0.01 && a.carregado>a.basico;
    window.dispatchEvent(new KeyboardEvent('keyup',{code:'AltLeft',bubbles:true}));
    const solto=t.anelAlcance()===null;
    return {puxando,soltou,flechas,ritmo,segura,longe,parou,alt,solto};
  })()`);
  expect(r).toEqual({
    puxando: true,
    soltou: true,
    flechas: 9,
    ritmo: true,
    segura: true,
    longe: true,
    parou: true,
    alt: true,
    solto: true,
  });
});
