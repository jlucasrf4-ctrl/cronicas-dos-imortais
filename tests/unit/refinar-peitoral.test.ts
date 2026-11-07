import {describe,expect,it} from 'vitest';
import {decodificarAnim,type DadosAnim} from '../../src/render/gl/esqueleto.ts';
import {refinarPeitoral} from '../../tools/lib/refinar-peitoral.ts';
const b64=(a:ArrayBufferView)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString('base64');
const id=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function dados(p:number[],i:number[]):DadosAnim{
 const j=new Uint8Array(p.length/3*4),w=new Uint8Array(j.length);for(let v=0;v<p.length/3;v++){j[v*4+1]=1;w[v*4]=128;w[v*4+1]=127;}
 return {versao:1,juntas:['Spine2','Shoulder'],pais:[-1,0],repouso:[[0,0,0],[0,0,0]],raiz:id,ibm:[id,id],clips:{},tex:'atlas',malha:{p:b64(Int16Array.from(p,v=>Math.round(v*64))),j:b64(j),w:b64(w),i:b64(Uint16Array.from(i)),c:b64(new Uint8Array(i.length).fill(190)),uv:b64(new Uint16Array(i.length*2).fill(12345))}};
}
const corpo=dados([0,31,-3,0,37,-3,0,37,3,0,31,3],[0,1,2,0,2,3]);
const roupa=dados([1,31,-2,1,31,2,1,34,-2,1,34,2,1.3,35,-2,1.3,35,2],[0,2,3,0,3,1,2,4,5,2,5,3]);
describe('refino local das alças',()=>{
 it('assenta os pontos altos sobre o corpo e preserva exatamente a região inferior, pintura e topologia',()=>{
  const original=JSON.stringify(roupa),A=decodificarAnim(roupa),R=refinarPeitoral(roupa,decodificarAnim(corpo),{deslocamentoMaximo:1.5,suavizacao:0}),B=decodificarAnim(R);
  expect(JSON.stringify(roupa)).toBe(original);
  expect(R.malha.i).toBe(roupa.malha.i);expect(R.malha.c).toBe(roupa.malha.c);expect(R.malha.uv).toBe(roupa.malha.uv);
  expect(Array.from(B.P.subarray(0,6))).toEqual(Array.from(A.P.subarray(0,6)));
  for(let v=2;v<6;v++){expect(B.P[v*3]).toBeLessThan(.2);expect(B.P[v*3]).toBeGreaterThan(.09);expect(B.W.subarray(v*4,v*4+4).reduce((a,b)=>a+b,0)).toBeCloseTo(1,5);}
  expect(B.P.every(Number.isFinite)).toBe(true);
 });
 it('respeita limite de deslocamento e não acrescenta faces degeneradas',()=>{
  const A=decodificarAnim(roupa),B=decodificarAnim(refinarPeitoral(roupa,decodificarAnim(corpo),{deslocamentoMaximo:.3}));
  for(let v=0;v<A.P.length/3;v++)expect(Math.hypot(...[0,1,2].map(e=>B.P[v*3+e]-A.P[v*3+e]))).toBeLessThanOrEqual(.32);
  for(let t=0;t<B.I.length;t+=3){const [a,b,c]=Array.from(B.I.subarray(t,t+3),v=>v*3),u=[0,1,2].map(e=>B.P[b+e]-B.P[a+e]),v=[0,1,2].map(e=>B.P[c+e]-B.P[a+e]);expect(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])).toBeGreaterThan(0);}
 });
});
