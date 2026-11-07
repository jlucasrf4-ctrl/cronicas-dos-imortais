/* ==== v8.1 — Perigo: alguém do clã, trabalhando sozinho, encontrou uma Runa Selvagem (map/perigo.ts; mantenedor,
   2026-10-30/31: "X está em perigo, leva a câmera até ele, chamar reforços, quem vai ou todo mundo; luta difícil com
   30% de chance de sucesso"; o mesmo aviso vai servir aos bandidos à noite) ==== */
export const PERIGO = {
  raio: 40, // unidades do mapa: o bicho rúnico tão perto de quem trabalha sozinho dispara o perigo
  sozinho: 0.3, // chance de vencer sozinho (deixar resolver)
  porReforco: 0.2, // cada reforço chamado soma tanto
  maxChance: 0.9,
  deixarMin: 20, // min de jogo até a luta deixada se resolver (ou até o reforço mais lento chegar, o que for mais)
  calma: 24 * 60, // min de jogo: depois de um perigo, o mesmo bicho rúnico não dispara outro por tanto tempo
  // no campo: o contador "ajuda a caminho" (s de verdade) = minutos de jogo do reforço mais lento × segPorMin
  segPorMin: 0.75,
  ajudaMin: 15,
  ajudaMax: 90,
  // o chefe: vida e dano do lobo (ou javali) do campo multiplicados
  chefeVida: 5,
  chefeDano: 1.5,
  // os reforços que chegam atiram flechas no chefe (até aliados lutarem junto): cada um, a cada `flechaCada` s
  flechaCada: 2.4,
  flechaDano: 7,
  // derrota: a vida que sobra e o ferimento (fração da vida máxima)
  vidaDerrota: 0.25,
  feridaDerrota: 0.35,
};
