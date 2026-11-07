/* v7.7 — ícones novos das pedras (px_*, de tools/gerar-icones-pedras.ts) e das runas absorvidas: cada runa aparece
   como a gema do seu elemento, mais lapidada quanto melhor o grau (rn_<elemento>_<1|2|3>). */
import { test, expect, entrarComHeroi, campoDireto } from "./comum.ts";

const PEDRAS = ["jaspe", "citrino", "lapis", "quartzo_rosa", "malaquita", "agata", "serpentina", "obsidiana"];
const ELS = ["fogo", "energia", "agua", "ar", "terra", "nularis"];

test("pedras e runas absorvidas com os ícones novos", async ({ jogo }) => {
  test.skip(jogo.referencia, "a v7.6 não tem os ícones das runas");
  await entrarComHeroi(jogo, "Ayla", 777, true);
  await campoDireto(jogo);
  // as pedras: comum, quartzo, ametista e as semipreciosas
  const chaves = await jogo.js<string[]>(`(()=>{const d=__t.dungeon; d.flow='x'; d.monsters.length=0;
    const inv=__t.ensureInv(d.hero); inv.items.length=0; const out=[];
    for (const k of ['pedra','quartzo','ametista']) { const it=__t.mkItem(k); __t.placeIn(inv,it); out.push(__t.icoKeyOf(it)); }
    for (const st of ${JSON.stringify(PEDRAS)}) { const it=__t.mkItem('pedra_rara'); it.st=st; __t.placeIn(inv,it); out.push(__t.icoKeyOf(it)); }
    if (!d.invOpen) __t.toggleInv(); return out;})()`);
  expect(chaves.map((k) => k.replace(/_\d+$/, ""))).toEqual([
    "px_pedra",
    "px_quartzo",
    "px_ametista",
    ...PEDRAS.map((s) => "px_" + s),
  ]);
  await jogo.esperar(400);
  await jogo.foto("pedras_mochila");
  // as runas: os três graus de cada elemento (a de liquidação usa a polida)
  const runas = await jogo.js<
    string[]
  >(`(()=>{const d=__t.dungeon, inv=__t.ensureInv(d.hero); inv.items.length=0; const out=[];
    for (const el of ${JSON.stringify(ELS)}) for (const g of ['fraturada','capturada','preciosa']) {
      const k='runa_'+g+'_'+el+'_quartzo'; __t.runeDef(k); const it=__t.mkItem(k); out.push(__t.icoKeyOf(it)); __t.placeIn(inv,it); }
    const lq='runa_liq_nularis_quartzo_2'; __t.runeDef(lq); out.push(__t.icoKeyOf(__t.mkItem(lq)));
    __t.toggleInv(); __t.toggleInv(); return out;})()`);
  expect(runas).toEqual([...ELS.flatMap((el) => [1, 2, 3].map((n) => `rn_${el}_${n}`)), "rn_nularis_3"]);
  await jogo.esperar(400);
  await jogo.foto("runas_mochila");
});
