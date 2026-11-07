/** Assenta as alças sobre a anatomia real, preservando a pintura e a silhueta inferior do peitoral. */
import { decodificarAnim, type Anim, type DadosAnim } from "../../src/render/gl/esqueleto.ts";
import { coberturaPorPeca, normaisVertice } from "./cobertura-roupa.ts";
export interface RefinoPeitoral {
  inicioY?: number;
  plenoY?: number;
  corpoMaxY?: number;
  folga?: number;
  deslocamentoMaximo?: number;
  suavizacao?: number;
  passos?: number;
  lateralMaxima?: number;
  limiteAlcaY?: number;
}
type V3 = [number, number, number];
type Tri = { ids: number[]; p: V3[]; n: V3[]; origens: V3[] };
const sub=(a:V3,b:V3)=>a.map((v,e)=>v-b[e]) as V3;
const dot=(a:V3,b:V3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:V3,b:V3):V3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function baricentricas(p:V3,a:V3,b:V3,c:V3):V3 {
  const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);
  if(d1<=0&&d2<=0)return[1,0,0];
  const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);
  if(d3>=0&&d4<=d3)return[0,1,0];
  const vc=d1*d4-d3*d2;
  if(vc<=0&&d1>=0&&d3<=0){const f=d1/(d1-d3);return[1-f,f,0];}
  const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);
  if(d6>=0&&d5<=d6)return[0,0,1];
  const vb=d5*d2-d1*d6;
  if(vb<=0&&d2>=0&&d6<=0){const f=d2/(d2-d6);return[1-f,0,f];}
  const va=d3*d6-d5*d4;
  if(va<=0&&d4-d3>=0&&d5-d6>=0){const f=(d4-d3)/(d4-d3+d5-d6);return[0,1-f,f];}
  const den=va+vb+vc;
  if(Math.abs(den)<1e-14)return[1,0,0];
  return[1-(vb+vc)/den,vb/den,vc/den];
}
const b64=(a:ArrayBufferView)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString('base64');
export function refinarPeitoral(camada:DadosAnim,corpo:Anim,config:RefinoPeitoral={}):DadosAnim {
  const inicio=config.inicioY??32,pleno=config.plenoY??34,maxY=config.corpoMaxY??37;
  const folga=config.folga??.13,maxDesl=config.deslocamentoMaximo??.9,forca=config.suavizacao??.22,passos=config.passos??3,lateral=config.lateralMaxima??7,limiteAlca=config.limiteAlcaY??35.6;
  if(!(inicio<pleno&&maxY>pleno&&folga>0&&maxDesl>0&&forca>=0&&forca<=.5&&passos>=0&&passos<=10))throw Error('Configuração de refino do peitoral inválida');
  if(camada.juntas.join('|')!==corpo.juntas.join('|'))throw Error('Peitoral e corpo usam juntas diferentes');
  const A=decodificarAnim(camada),nv=A.P.length/3,N=normaisVertice(corpo.P,corpo.I);
  const tris:Tri[]=[];
  for(let t=0;t<corpo.I.length;t+=3){
    const ids=Array.from(corpo.I.subarray(t,t+3)),p=ids.map(v=>Array.from(corpo.P.subarray(v*3,v*3+3)) as V3);
    if(Math.max(...p.map(p=>p[1]))<inicio-.5||Math.min(...p.map(p=>p[1]))>maxY)continue;
    const normal=cross(sub(p[1],p[0]),sub(p[2],p[0]));if(dot(normal,normal)<1e-12)continue;
    // A alça termina na clavícula: a base do pescoço não participa da busca de superfície.
    const nn=ids.map(v=>Array.from(N.subarray(v*3,v*3+3)) as V3);
    let pol=p.map((p,k)=>({p,n:nn[k],o:[0,1,2].map(e=>e===k?1:0) as V3}));
    const cortada:typeof pol=[];
    for(let k=0;k<pol.length;k++){
      const a=pol[k],b=pol[(k+1)%pol.length],da=a.p[1]<=limiteAlca,db=b.p[1]<=limiteAlca;
      if(da)cortada.push(a);
      if(da!==db){const f=(limiteAlca-a.p[1])/(b.p[1]-a.p[1]),mix=(a:V3,b:V3)=>a.map((v,e)=>v+(b[e]-v)*f) as V3;cortada.push({p:mix(a.p,b.p),n:mix(a.n,b.n),o:mix(a.o,b.o)});}
    }
    pol=cortada;
    for(let k=1;k+1<pol.length;k++){const fan=[pol[0],pol[k],pol[k+1]];tris.push({ids,p:fan.map(v=>v.p),n:fan.map(v=>v.n),origens:fan.map(v=>v.o)});}
  }
  if(!tris.length)throw Error('Corpo sem superfície na faixa das alças');
  function superficie(p:V3){
    let melhor: {tri:Tri;ws:V3;p:V3;n:V3;dist:number}|null=null;
    for(const tri of tris){
      const ws=baricentricas(p,...tri.p as [V3,V3,V3]);
      const q=[0,1,2].map(e=>tri.p.reduce((s,a,k)=>s+a[e]*ws[k],0)) as V3;
      const d=dot(sub(p,q),sub(p,q));if(melhor&&d>=melhor.dist)continue;
      const n=[0,1,2].map(e=>tri.n.reduce((s,a,k)=>s+a[e]*ws[k],0)) as V3,l=Math.hypot(...n)||1;
      melhor={tri,ws,p:q,n:n.map(v=>v/l) as V3,dist:d};
    }
    return melhor!;
  }
  const viz=Array.from({length:nv},()=>new Set<number>()),fator=Array.from({length:nv},(_,v)=>{
    const f=Math.max(0,Math.min(1,(A.P[v*3+1]-inicio)/(pleno-inicio))),l=Math.max(0,Math.min(1,(Math.abs(A.P[v*3+2])-(lateral-1.5))/1.5));return f*f*(3-2*f)*(1-l*l*(3-2*l));
  });
  for(let t=0;t<A.I.length;t+=3)for(let k=0;k<3;k++){const a=A.I[t+k],b=A.I[t+(k+1)%3];viz[a].add(b);viz[b].add(a);}
  // Solda lógica das cartas UV: os cantos sobrepostos são corrigidos juntos.
  const grupos=new Map<string,number[]>();
  for(let v=0;v<nv;v++){const key=Array.from(A.P.subarray(v*3,v*3+3),p=>Math.round(p*64)).join(',');const g=grupos.get(key)??[];g.push(v);grupos.set(key,g);}
  for(const g of grupos.values())if(g.length>1){const unidos=new Set(g.flatMap(v=>[...viz[v]]));for(const v of g)viz[v]=unidos;}
  let P=A.P.slice();
  for(let passo=0;passo<passos;passo++){
    const Q=P.slice();
    for(let v=0;v<nv;v++)if(fator[v]&&viz[v].size)for(let e=0;e<3;e++){
      let media=0;for(const n of viz[v])media+=P[n*3+e];media/=viz[v].size;
      Q[v*3+e]+= (media-P[v*3+e])*forca*fator[v];
    }
    P=Q;
  }
  const J=A.J.slice(),W8=Uint8Array.from(A.W,w=>Math.round(w*255));
  for(const g of grupos.values()){
    const v=g[0];if(!fator[v])continue;
    const perto=superficie(Array.from(P.subarray(v*3,v*3+3)) as V3);
    const alvo=perto.p.map((p,e)=>p+perto.n[e]*folga) as V3;
    const delta=alvo.map((p,e)=>(p-A.P[v*3+e])*fator[v]) as V3;
    const dist=Math.hypot(...delta),f=dist>maxDesl?maxDesl/dist:1;
    const pesos=new Map<number,number>();
    const wsOriginais=[0,1,2].map(k=>perto.tri.origens.reduce((s,o,v)=>s+o[k]*perto.ws[v],0));
    perto.tri.ids.forEach((id,k)=>{for(let e=0;e<4;e++){const j=corpo.J[id*4+e],w=corpo.W[id*4+e]*wsOriginais[k];pesos.set(j,(pesos.get(j)??0)+w);}});
    const lista=[...pesos].filter(([,w])=>w>0).sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,4),soma=lista.reduce((s,[,w])=>s+w,0);
    const jj=new Uint8Array(4),ww=new Uint8Array(4);lista.forEach(([j,w],k)=>{jj[k]=j;ww[k]=Math.round(w/soma*255);});ww[0]+=255-ww.reduce((a,b)=>a+b,0);
    for(const n of g){for(let e=0;e<3;e++)P[n*3+e]=A.P[n*3+e]+delta[e]*f;J.set(jj,n*4);W8.set(ww,n*4);}
  }
  // Evita inverter faces quando uma alça estreita é trazida para junto da pele.
  for(let passo=0;passo<8;passo++){
    const ruins=new Set<number>();
    for(let t=0;t<A.I.length;t+=3){
      const ids=Array.from(A.I.subarray(t,t+3));
      const face=(p:Float32Array)=>{const v=ids.map(i=>Array.from(p.subarray(i*3,i*3+3)) as V3);return cross(sub(v[1],v[0]),sub(v[2],v[0]));};
      const antes=face(A.P),depois=face(P);
      if(dot(antes,antes)>1e-10&&(dot(antes,depois)<=0||dot(depois,depois)<1e-10))for(const v of ids)if(fator[v])ruins.add(v);
    }
    if(!ruins.size)break;
    for(const v of ruins)for(let e=0;e<3;e++)P[v*3+e]=(P[v*3+e]+A.P[v*3+e])*.5;
  }
  const saida:DadosAnim={...camada,malha:{...camada.malha,p:b64(Int16Array.from(P,p=>Math.round(p*64))),j:b64(J),w:b64(W8)}};
  saida.coberturaCorpo=coberturaPorPeca(corpo,decodificarAnim(saida),1.8);
  return saida;
}
