import { beforeEach, describe, expect, it } from "vitest";
import {
  campanha,
  campanhaEvento,
  campanhaEventoAtual,
  campanhaIr,
  campanhaPular,
  missaoAtual,
  missaoParalela,
} from "../../src/campanha/campanha.ts";
import { FALANTES, FALAS, MISSAO_INICIAL, MISSOES, ATOS } from "../../src/data/campanha.ts";
import { EQ_BASE } from "../../src/data/equipamento.ts";
import { econ } from "../../src/core/state.ts";

// v7.7 — campanha: a corrente de missões (data/campanha.ts) e como ela anda (campanha/campanha.ts).
beforeEach(() => {
  delete econ.campanha;
  delete econ.campTut;
  delete econ.introDone;
});

describe("tabela de missões", () => {
  it("as duas correntes (principal e a paralela que um `abre` começa) passam por todas, sem laço nem próxima que não existe", () => {
    const vistas = new Set<string>();
    const percorrer = (inicio: string | null, paralela: boolean) => {
      for (let id = inicio; id; id = MISSOES[id].proxima) {
        expect(MISSOES[id], id).toBeDefined();
        expect(vistas.has(id), "laço ou missão em duas correntes: " + id).toBe(false);
        expect(!!MISSOES[id].linha, id + (paralela ? " devia ter" : " não devia ter") + " `linha`").toBe(paralela);
        vistas.add(id);
      }
    };
    percorrer(MISSAO_INICIAL, false);
    for (const m of Object.values(MISSOES).filter((m) => m.abre)) percorrer(m.abre!, true);
    expect([...vistas].sort()).toEqual(Object.keys(MISSOES).sort());
  });

  it("todo ato existe, todo evento é único e as falas têm quem fala", () => {
    const evs = Object.values(MISSOES)
      .map((m) => m.conclui)
      .filter(Boolean);
    expect(new Set(evs).size).toBe(evs.length);
    for (const m of Object.values(MISSOES)) expect(ATOS[m.ato]).toBeDefined();
    for (const f of Object.values(FALAS)) {
      expect(FALANTES[f.quem]).toBeDefined();
      expect(f.paginas.length).toBeGreaterThan(0);
    }
  });
});

describe("andamento", () => {
  it("jogo novo começa na missão inicial", () => {
    expect(campanha().etapa).toBe(MISSAO_INICIAL);
  });

  it("save de antes da campanha: a etapa sai das marcas antigas", () => {
    econ.introDone = true;
    expect(campanha().etapa).toBe("a1_acampamento");
    delete econ.campanha;
    econ.campTut = 3;
    expect(campanha().etapa).toBe("a2_livre");
  });

  it("o evento da missão atual conclui e passa para a próxima; evento de outra não faz nada", () => {
    expect(campanhaEvento("acampamentoChegou")).toBe(true); // mais adiante: pula a abertura junto
    expect(campanha().etapa).toBe("a1_noite");
    expect(Object.keys(campanha().feitas).sort()).toEqual(["a1_abertura", "a1_acampamento"]);
    expect(campanhaEvento("introFim")).toBe(false); // já ficou para trás
    expect(campanhaEvento("nada")).toBe(false);
    expect(campanha().etapa).toBe("a1_noite");
  });

  it("evento fora de hora (campanhaEventoAtual) só vale para a missão atual: não pula a corrente", () => {
    campanhaIr("a3_lobo");
    expect(campanhaEventoAtual("forjou_eq_armadura")).toBe(false); // forjou antes (receita de um projeto)
    expect(campanha().etapa).toBe("a3_lobo");
    campanhaIr("a3_armadura");
    expect(campanhaEventoAtual("forjou_eq_armadura")).toBe(true);
    expect(campanha().etapa).toBe("a4_vila");
  });

  it("v8.0: o cercado abre a linha dos lobos; cada corrente anda com os seus eventos, sem travar a outra", () => {
    campanhaIr("a3_cercado");
    expect(campanha().paralela).toBeUndefined();
    expect(campanhaEvento("falouLoboVivo")).toBe(true);
    expect([campanha().etapa, campanha().paralela]).toEqual(["a3_costura", "a3_espera"]);
    expect(campanhaEvento("cercadoVisto")).toBe(true); // da paralela
    expect([campanha().etapa, campanha().paralela]).toEqual(["a3_costura", "a3_alimentar"]);
    expect(campanhaEvento("falouCostura")).toBe(true); // da principal
    expect([campanha().etapa, campanha().paralela]).toEqual(["a3_armadura", "a3_alimentar"]);
    expect(missaoParalela()!.linha).toBe("lobos");
    // ir direto a uma missão de lobo muda só a paralela; a última fecha a linha (null, não abre de novo)
    campanhaIr("a3_cria");
    expect([campanha().etapa, campanha().paralela]).toEqual(["a3_armadura", "a3_cria"]);
    expect(campanhaEventoAtual("noiteCria")).toBe(true);
    expect(campanha().paralela).toBeNull();
    expect(missaoParalela()).toBeNull();
  });

  it("v8.0: save de antes da linha paralela, parado numa missão de lobo, é migrado pelas feitas", () => {
    const feitas = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, 1]));
    const ate = ["a1_abertura", "a1_acampamento", "a1_noite", "a2_livre", "a3_brasa", "a3_lobo", "a3_carregar"];
    // no meio do vínculo: a corrente vai para a costura, a paralela fica no vínculo
    econ.campanha = {
      etapa: "a3_vinculo",
      feitas: feitas([...ate, "a3_cercado", "a3_espera", "a3_alimentar"]),
      flags: {},
    };
    expect([campanha().etapa, campanha().paralela]).toEqual(["a3_costura", "a3_vinculo"]);
    // já com a armadura (cuidando do casal): a corrente vai para a vila
    const depois = [...ate, "a3_cercado", "a3_espera", "a3_alimentar", "a3_vinculo", "a3_pedido", "a3_costura"];
    econ.campanha = { etapa: "a3_filhote", feitas: feitas([...depois, "a3_armadura", "a3_cuidar"]), flags: {} };
    expect([campanha().etapa, campanha().paralela]).toEqual(["a4_vila", "a3_filhote"]);
    // na armadura (corrente principal): a paralela abre na primeira de lobo não feita
    econ.campanha = { etapa: "a3_armadura", feitas: feitas(depois), flags: {} };
    expect([campanha().etapa, campanha().paralela]).toEqual(["a3_armadura", "a3_cuidar"]);
    // antes do cercado: nada muda
    econ.campanha = { etapa: "a3_lobo", feitas: feitas(ate.slice(0, 5)), flags: {} };
    expect([campanha().etapa, campanha().paralela]).toEqual(["a3_lobo", undefined]);
  });

  it("missões com fala de chamado e receita a aprender apontam para falas e peças que existem", () => {
    for (const [id, m] of Object.entries(MISSOES)) {
      if (m.chamado) expect(FALAS[m.chamado], id).toBeDefined();
      if (m.aprende) expect(EQ_BASE[m.aprende], id).toBeDefined();
    }
  });

  it("pular e ir direto", () => {
    expect(campanhaPular()).toBe("a1_acampamento");
    expect(campanhaIr("a2_livre")).toBe(true);
    expect(missaoAtual()!.ato).toBe(2);
    expect(campanhaIr("nao_existe")).toBe(false);
    expect(campanhaIr(null)).toBe(true);
    expect(missaoAtual()).toBeNull();
    expect(campanhaPular()).toBeNull();
  });
});
