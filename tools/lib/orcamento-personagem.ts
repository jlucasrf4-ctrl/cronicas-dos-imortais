/* v8.1 — a roupa reserva espaço para qualquer cabeça compatível, arma, arco e escudo. */
import { existsSync, readFileSync } from "node:fs";
import type { AparenciasDados } from "../../src/render/gl/aparencias.ts";
type Orcamento = Record<"peito" | "pernas" | "pes", number>;
/** Limite solicitado pelo mantenedor em 05/11/2026; rostos recebem prioridade na redução. */
export const ORCAMENTO_PERSONAGEM = { total: 25000, equipamentos: 4200, cabeca: 8000, busto: 10000, corpo: 16500, rostoCorpo: 6500 } as const;
export function distribuirOrcamentoRoupa(triangulosPele: number, padrao: Orcamento): Orcamento {
  const disponivel = ORCAMENTO_PERSONAGEM.total - triangulosPele - ORCAMENTO_PERSONAGEM.equipamentos;
  if (!Number.isFinite(triangulosPele) || triangulosPele < 0 || disponivel <= 0)
    throw new Error("Não sobra orçamento para a roupa");
  const soma = padrao.peito + padrao.pernas + padrao.pes;
  if (Object.values(padrao).some((v) => !Number.isFinite(v) || v < 0) || soma <= 0)
    throw new Error("Orçamento de roupa inválido");
  const fator = Math.min(1, disponivel / soma);
  return { peito: Math.floor(padrao.peito * fator), pernas: Math.floor(padrao.pernas * fator), pes: Math.floor(padrao.pes * fator) };
}
let dados: AparenciasDados | undefined;
export function orcamentoRoupa(nome: string, padrao: Orcamento): Orcamento {
  dados ??= JSON.parse(readFileSync("src/assets/models/aparencias.json", "utf8")) as AparenciasDados;
  const [nomeCorpo, nomeCabeca] = nome.split("__");
  const corpo = dados.corpos?.find((c) => c.nome === nomeCorpo);
  if (!corpo) return padrao;
  const cabecas = dados.cabecas?.filter((c) => (c.sexo ?? "f") === (corpo.sexo ?? "f")) ?? [];
  const maiorCabeca = Math.max(0, ...cabecas.map((c) => Buffer.from(c.i, "base64").length / 6));
  let pele = Buffer.from(corpo.semCabeca.malha.i, "base64").length / 6 + maiorCabeca;
  const caminho = nomeCabeca ? `build/modelos/busto_integral_${nome}.json` : "src/assets/models/bustos-integrais.json";
  if (existsSync(caminho)) {
    const pacote = JSON.parse(readFileSync(caminho, "utf8")) as { anim?: { malha: { i: string } }; combinacoes?: { corpo: string; anim: { malha: { i: string } } }[] };
    if (pacote.anim) pele = Buffer.from(pacote.anim.malha.i, "base64").length / 6;
    else for (const v of pacote.combinacoes ?? []) if (v.corpo === nomeCorpo) pele = Math.max(pele, Buffer.from(v.anim.malha.i, "base64").length / 6);
  }
  return distribuirOrcamentoRoupa(pele, padrao);
}
