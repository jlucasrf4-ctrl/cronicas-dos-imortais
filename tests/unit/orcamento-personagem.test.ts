import { describe, expect, it } from "vitest";
import { distribuirOrcamentoRoupa, ORCAMENTO_PERSONAGEM } from "../../tools/lib/orcamento-personagem.ts";
describe("orçamento de 25 mil com prioridade facial", () => {
  const padrao = { peito: 1700, pernas: 1800, pes: 400 };
  it("preserva a roupa quando o rosto mais detalhado ainda cabe no conjunto", () => {
    expect(ORCAMENTO_PERSONAGEM.total).toBe(25000);
    expect(distribuirOrcamentoRoupa(16000, padrao)).toEqual(padrao);
  });
  it("reserva os equipamentos e distribui o restante sem ultrapassar o teto", () => {
    const roupa = distribuirOrcamentoRoupa(18000, padrao);
    expect(roupa.peito + roupa.pernas + roupa.pes + 18000 + ORCAMENTO_PERSONAGEM.equipamentos).toBeLessThanOrEqual(
      25000,
    );
    expect(roupa.peito).toBeLessThan(padrao.peito);
    expect(() => distribuirOrcamentoRoupa(20800, padrao)).toThrow();
    expect(() => distribuirOrcamentoRoupa(NaN, padrao)).toThrow();
  });
});
