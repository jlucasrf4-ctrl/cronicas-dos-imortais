/* ==== v8.1 — cores de pele e de cabelo das aparências (render/gl/aparencias.ts, editor/aparencias_qc.ts) ====
   Cada personagem novo sorteia um tom de pele e uma cor de cabelo destas paletas (peso de cada um); "" = a cor
   original do modelo. No painel 👤 Aparências do Modo Editor dá para trocar à mão (também por uma cor livre). */
export const PALETA_PELE: { cor: string; nome: string; peso: number }[] = [
  { cor: "", nome: "Original", peso: 4 },
  { cor: "#f2d3bd", nome: "Clara", peso: 1 },
  { cor: "#e6b896", nome: "Pêssego", peso: 1 },
  { cor: "#d9a074", nome: "Bronzeada", peso: 1 },
  { cor: "#b97b55", nome: "Morena", peso: 1 },
  { cor: "#8d5a3c", nome: "Escura", peso: 1 },
  { cor: "#5e3a26", nome: "Muito escura", peso: 1 },
];
export const PALETA_CABELO: { cor: string; nome: string; peso: number }[] = [
  { cor: "", nome: "Original", peso: 4 },
  { cor: "#1f1a18", nome: "Preto", peso: 1 },
  { cor: "#4a2e1f", nome: "Castanho escuro", peso: 1 },
  { cor: "#7a4a2a", nome: "Castanho", peso: 1 },
  { cor: "#d8b06a", nome: "Loiro", peso: 1 },
  { cor: "#9a3b1e", nome: "Ruivo", peso: 1 },
  { cor: "#c9c4c0", nome: "Grisalho", peso: 0.5 },
  { cor: "#e8e6f0", nome: "Branco", peso: 0.3 },
  { cor: "#2c3a6e", nome: "Azul-marinho", peso: 0.3 },
  { cor: "#7a4fa0", nome: "Roxo", peso: 0.3 },
  { cor: "#d87aa8", nome: "Rosa", peso: 0.3 },
  { cor: "#5f8a4a", nome: "Verde", peso: 0.3 },
];
/** Cabeças fora do sorteio e da escolha da criação por serem MUITO parecidas com outra (mantenedor, 2026-11-06:
 *  "exclua as personagens que forem muito parecidas, deixe enxuto"). A cor de pele e de cabelo é tingida, então conta o
 *  formato. Continuam nos dados (o Modo Editor mostra todas; o busto integral usa a busto_03 e a busto_06; quem já
 *  nasceu com uma delas continua com ela). Fica → sai:
 *  busto_05 (ruiva cacheada curta) → busto_03 · busto_09 (castanha cacheada volumosa) → busto_08 ·
 *  busto_14 (trança de lado) → busto_07 e busto_11 · busto_04 (castanha longa de lado) → busto_12 ·
 *  busto_16 (platinada solta) → busto_06 · ruiva_rabo (rabo alto) → rosa · morena_argolas → morena_tiara */
export const CABECAS_FORA = [
  "busto_03",
  "busto_08",
  "busto_07",
  "busto_11",
  "busto_12",
  "busto_06",
  "rosa",
  "morena_tiara",
];
/** Bustos integrais que não entram (2026-11-07, mantenedor: "a f16 tá sempre com problema ajusta ela
 *  individualmente"): a combinação usa a cabeça trocada, como nos outros corpos, com a gola, e as roupas genéricas do
 *  corpo (render/gl/vestidos.ts roupaDaAparencia), não as feitas para a montagem integral. A busto_16 integral da F02
 *  tem o cabelo comprido modelado deitado sobre o braço esticado (pose T): no idle ele virava uma lâmina de lado por
 *  cima do ombro e da ombreira; a cabeça saía bem menor (escala 0,6) e o rosto, 0,65 u fora do meio. A trocada tem o
 *  cabelo caindo reto. */
export const INTEGRAIS_FORA = ["corpo_f02|busto_16"];
/** O cabelo apoiado no ombro acompanha o ombro (2026-11-07, mantenedor: "parte da ombreira aqui parece ser afetada pelo
 *  cabelo ajusta pfv"): as mechas foram modeladas deitadas sobre o ombro da pose T, mas iam só com a cabeça; quando o
 *  braço desce, o ombro sai de baixo delas e a mecha corta a ombreira (a da frente da busto_04). O vértice de cabelo
 *  abaixo de `abaixo` u sob o queixo, a até `contato` u de um vértice de pele cujo peso no ombro/braço é ao menos
 *  `braco`, passa a misturar os pesos dele com os desse vértice (tudo, encostado; nada, a `contato` u). Em u. */
export const CABELO_OMBRO = { abaixo: 0.5, contato: 0.6, braco: 0.15 };
/** Refino da cabeça dos bustos integrais (render/gl/aparencias.ts ajustarBustoIntegral), por "corpo|cabeça" (2026-11-07,
 *  mantenedor: "dá uma refinada na posição e tamanho de todas as cabeças"): as cabeças dos bustos saíam ~1,4× maiores
 *  que as trocadas e altas, num pescoço comprido. `baixar`: quanto a cabeça desce (unidades do jogo; o pescoço encurta);
 *  `escala`: o tamanho da cabeça, em torno do queixo. Medido nas prévias de build/tmp/previa_cabecas.ts. */
export const AJUSTE_BUSTO: Record<string, { baixar: number; escala: number }> = {
  "corpo_f01|busto_01": { baixar: 2.6, escala: 0.85 },
  "corpo_f02|busto_02": { baixar: 0.5, escala: 0.75 },
  "corpo_f02|busto_01": { baixar: 0.7, escala: 0.82 },
  "corpo_f02|busto_03": { baixar: 0.3, escala: 1 },
  "corpo_f02|busto_04": { baixar: 0.3, escala: 0.8 },
  "corpo_f04|busto_04": { baixar: 1.4, escala: 0.8 },
  "corpo_f05|busto_05": { baixar: 1.3, escala: 0.75 },
  "corpo_f06|busto_06": { baixar: 1.2, escala: 1 },
};
/** O tingimento pela máscara (render/gl/aparencias.ts tingir), em CIELAB: cada triângulo guarda a diferença dele para a
 *  mediana da parte (2026-11-06; antes, metade da luz e nenhum matiz: a pele chapava). `luz`: limites do fator da
 *  diferença de luz (a razão L da cor nova / L da mediana) — no cabelo preto vindo do loiro as mechas ainda aparecem
 *  (mínimo), no loiro vindo do preto não viram listras (máximo). `croma`: idem para o matiz (cabelo grisalho perde o
 *  colorido das mechas). `textura`: o multiplicador por canal dos triângulos com textura fica a `desvio`× da razão de
 *  luz e no máximo `max` (um canal sozinho estourava um texel claro em azul). */
export const TINGIR = {
  pele: { luz: [0.55, 1.5] as [number, number], croma: [0.4, 1.2] as [number, number] },
  cabelo: { luz: [0.45, 1.6] as [number, number], croma: [0.3, 1.2] as [number, number] },
  textura: { desvio: 1.6, max: 4 },
};
/** O encaixe da cabeça trocada (render/gl/aparencias.ts comporPele, 2026-11-07; mantenedor: "centraliza a cabeça no
 *  pescoço e ombros"). De lado, o nariz vai na linha do meio do esqueleto (antes ia no "meio" do rosto do corpo, que o
 *  cabelo de lado puxava até 0,5 u para fora). Na frente/trás, a cabeça anda até `recuo`..`avanco` u para o pescoço dela
 *  cair dentro da abertura do pescoço do corpo (a média das menores distâncias da borda da abertura à pele do pescoço,
 *  descartando a fração `descarte` das piores, mais `freio` × deslocamento² para preferir ficar onde estava), em passos
 *  de `passo` u. Em u (a distância olhos–queixo do corpo). */
export const ENCAIXE_CABECA = { recuo: 0.6, avanco: 0.4, passo: 0.04, descarte: 0.2, freio: 0.15 };
/** O acabamento do pescoço da cabeça trocada (render/gl/gola.ts acabarPescoco, 2026-11-07; mantenedor: "se aparece
 *  aquele vão coloque algum volume de objeto pra disfarçar esse aspecto de cabeça colada flutuando faltando pedaço").
 *  Antes da gola: os buracos que o recorte do cabelo original deixou no corpo e que não dão a volta no pescoço (a borda
 *  gira menos de `voltaLateral` × 180° em torno do eixo dele, visto de cima: a tira no peito da F05) fecham com pele; a
 *  abertura do pescoço dá uma volta inteira (360°) e fica para a gola. E a pele da cabeça ligada ao pescoço
 *  (o que está a até `raioPescoco` u do eixo um pouco abaixo do queixo) abaixo de `recolherAcima` u sob o queixo que
 *  atravessa o peito, colada nele (até `recolherFolga` u para fora), volta para dentro dele (o resto de colo de algumas
 *  cabeças virava um "V" de outra pele; as tranças, mais afastadas, ficam).
 *  A gola: um pano em volta do pescoço da cabeça trocada,
 *  só quando a borda da abertura do corpo fica para fora da pele do pescoço da cabeça (o vão) em `vaoMin` pontos ou mais.
 *  Ela cobre de `margemBaixo` u abaixo do ponto descoberto mais baixo até `margemCima` u acima do mais alto, nunca acima
 *  do queixo + `topoFrente` u na frente (embaixo do queixo) e + `topoTras` u atrás, nem abaixo de `fundo` u; no mínimo
 *  `alturaMin` u de altura. O pano fica `folga` u afastado da pele nas bordas e `espessura` u no meio (o rolo), procura a
 *  pele até `alcance` u do eixo do pescoço e assenta na primeira camada dela (camadas a menos de `camada` u uma da outra
 *  contam juntas: pele, camisa, colete; o ombro mais longe não; um raio que salta mais de `salto` u para fora dos
 *  vizinhos escapou entre camadas e é descartado). Borda de roupa não é vão: se olhando para dentro dela
 *  há outra camada a menos de `porTras` u, é a beira do colete/placa por cima do corpo. Também conta como vão a borda
 *  aberta da pele do pescoço da cabeça fora do corpo, até `furoCabeca` u abaixo do queixo (as cabeças de busto têm a pele
 *  beliscada embaixo da mandíbula). Com peitoral vestido, a borda que tem a peça a menos de `sobRoupa` u (por fora ou
 *  por dentro: a Líder veste as peças da F01, que não batem com o corpo dela) fica escondida e não conta (sem isso a gola
 *  da Líder virava um poncho por cima da placa). A bainha de baixo
 *  cai no máximo `inclinacao` u por radiano dos lados de um ponto
 *  fundo (um bico largo, não uma língua). `colunas` × `linhas` faces.
 *  Pontos em u (olhos–queixo). As cores (rgb 0..255) são tecidos/couros; cada combinação corpo|cabeça pega uma, longe
 *  da cor do cabelo e da pele. */
export const GOLA = {
  /** "pele" (2026-11-07, mantenedor: "o ideal é simular o tom de pele e desenho do decote"): o mesmo formato, rente
   *  (`pescocoPele` u), e cada face pega a cor do que está embaixo dela (a pele do corpo, ou a roupa onde a emenda cai
   *  na gola da camisa), indo para a pele do rosto no alto; nenhuma cor nova. "pano": a gola de tecido (cores abaixo).
   *  Nos corpos de `panoNos` vai sempre o pano. */
  modo: "pele" as "pano" | "pele",
  panoNos: [] as string[],
  /** os restos do cabelo original na boca do pescoço do corpo (render/gl/gola.ts restosDeCabeloNoPescoco): vermelho
   *  saturado do queixo − `baixo` u ao queixo + `alto` u, a até `raio` u da junta Neck, em ilhas de até `ilhaMax`
   *  triângulos que não descem além de `ilhaFundo` u nem passam de `ilhaRaio` u (o lenço da Líder fica) */
  restos: { baixo: 0.7, alto: 0.3, raio: 1.3, ilhaMax: 40, ilhaFundo: 0.85, ilhaRaio: 1.6 },
  pescocoPele: { folga: 0.012, espessura: 0.03, roupaAte: 0.15 },
  vaoMin: 3,
  margemBaixo: 0.16,
  margemCima: 0.12,
  topoFrente: -0.3,
  topoTras: 0.32,
  fundo: 3.3,
  alturaMin: 0.5,
  folga: 0.05,
  espessura: 0.17,
  alcance: 2.1,
  camada: 0.3,
  porTras: 0.45,
  salto: 0.35,
  furoCabeca: 0.9,
  inclinacao: 0.9,
  voltaLateral: 1,
  recolherAcima: 0.6,
  raioPescoco: 1.0,
  recolherFolga: 0.25,
  sobRoupa: 0.6,
  colunas: 28,
  linhas: 6,
  cores: [
    [92, 60, 42], // couro marrom
    [112, 42, 44], // lã vinho
    [68, 86, 56], // verde-musgo
    [56, 72, 98], // azul-ardósia
    [146, 122, 88], // linho cru
    [64, 60, 58], // carvão
  ] as number[][],
};
