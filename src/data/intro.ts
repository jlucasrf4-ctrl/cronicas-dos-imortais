/* ==== Fase 4 ====
   cena inicial e tutorial: o javali da abertura, flechas antes da investida, observações da faca e dicas do
   caçador. Saíram de v6.1 e v6.5 */

/* javali da cena inicial: Alfa, rápido demais para desviar (fora a lição do rolamento, ISC_ESQUIVA), bate forte;
   v8.0: o Caçador acerta a flecha antes do 2º golpe (ou com 30% de vida, `resgate`) */
export const ISC_BOAR = {
  vel: 430,
  mira: [0.8, 1.3],
  pausa: [1.2, 1.9],
  curva: 3.2,
  dano: 0.24,
  resgate: 0.3,
  tam: 1.3,
};
/* --- ANALISAR a faca --- */
export const KNIFE_OBS = [
  ["Lâmina", "Ferro batido, fino e gasto. Foi amolado muitas vezes."],
  ["Formato", "Ponta reta, um lado só com fio — feita para furar e cortar couro."],
  ["Cabo", "Madeira dura, um galho escolhido a dedo e esculpido."],
  ["Fixação", "A espiga da lâmina entra no cabo e é presa com tiras de couro molhado que encolheram ao secar."],
  ["Estrutura", "Curta e equilibrada perto da mão: rápida, mas sem alcance."],
  ["Materiais", "1 ferro · 1 cabo (um galho esculpido na carpintaria) · um pouco de couro."],
];
/* --- no acampamento: o Caçador fica perto da fogueira e conversa --- */
export const HUNTER_TIPS = [
  ["Galho e pedra viram flecha. Pena faz voar reto.", "Na masmorra, o crafting é o 🔨 (C)."],
  ["Bicho ferido não foge longe. Uma corda resolve.", "E a faca termina o serviço sem estragar a pele."],
  ["A Runa Natural…", "Dizem que um coelho foi visto brilhando perto de uma pedra antiga. Bobagem? Talvez."],
  ["Toda arma que você achar pode te ensinar alguma coisa.", "Analise antes de vender."],
];
export const ISC_FINTA = 2; // flechas disparadas antes da 1ª investida de verdade
/* v8.0 — a lição do rolamento (mantenedor, 2026-10-23): na 1ª investida que ia acertar, o tempo desacelera e, perto
   dela, congela com a tela "Aperte ESPAÇO para desviar" (#isc-esq) até ela rolar; rolou = passa por ele. A investida
   seguinte acerta (uma vez) e, antes da segunda, o Caçador aparece. Distâncias em tiles da heroína; `lenta` =
   velocidade do tempo ao avisar; `rolando` = velocidade logo depois de rolar, que volta a 1 em `volta` s (reais). */
export const ISC_ESQUIVA = { aviso: 3.4, perto: 1.6, lenta: 0.18, rolando: 0.35, volta: 0.8 };
/* v8.0 — a caminhada do fim da cena inicial (intro/caminhada.ts; mantenedor, 2026-10-23): o campo continua, agora o
   pedaço do mapa ao sul do acampamento; ela anda para o norte vendo bichos e achando flechas e comida no chão; v8.1:
   o acampamento aparece no campo e ela entra pela fogueira (field/acampamento_campo.ts). Distâncias em unidades do
   mapa (uma casa do campo ≈ 6,5): `dist` do acampamento até onde ela começa (procura um caminho sem água num leque de
   `leque` rad em volta do sul). `itens`: o que fica no chão pelo caminho (chave do chão, quantos); `bichos`: os que
   nascem no mapa pelo caminho. */
export const ISC_CAMINHO = {
  dist: 130,
  leque: 1.2,
  itens: [
    ["flecha", 4],
    ["carne_assada", 2],
  ] as [string, number][],
  bichos: ["rabbit", "rabbit", "deer"],
  lado: 2.5, // casas para o lado do caminho onde os itens e bichos ficam
  /** v8.1 — o lobo do caminho (intro/caminhada.ts), em fração do caminho andado: `uiva`, o uivo e ele aparece de lado,
      seguindo a `espreita` casas; `ataca`, ele vem; desiste com a vida dela abaixo de `fogeVida` (fração) ou perto da
      fogueira (ACAMP_CAMPO.fogoAfasta). */
  lobo: { uiva: 0.28, ataca: 0.58, espreita: 7, fogeVida: 0.3 },
};
