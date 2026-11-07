import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { carregarJogo, retrato, type JogoVm } from "../../tools/lib/vm-jogo.ts";
import { scriptPrincipal } from "../../tools/lib/html.ts";
import { construirJogo } from "../../tools/lib/construir.ts";

// Teste diferencial da Fase 3: o jogo montado de src/ e a referência v7.6 rodam o MESMO roteiro, no Node (sem
// navegador, ver tools/lib/vm-jogo.ts), com a mesma semente. Depois de cada passo o estado (dungeon, econ, heróis)
// tem que ser idêntico. Fundir as cadeias de sobrescrita não pode mudar nada disso.
// Limite: só cobre a lógica alcançada pelos roteiros abaixo (o DOM é falso, nada é desenhado de verdade).
const REF = scriptPrincipal(readFileSync("reference/vtest_v7.6.html", "utf8").replace(/\r\n/g, "\n"));
// Fase 4: o lado novo é o JS empacotado pelo Vite (módulos ES + script legado), o mesmo que vai para dist/vtest.html.
const NOVO = scriptPrincipal(await construirJogo({ teste: true }));

/* eslint-disable @typescript-eslint/no-explicit-any */
type Roteiro = (j: Jogo) => void;

/** Escritas no DOM que uma correção tirou de propósito (ver "correções em relação à v7.6"): não entram na comparação. */
const CORRIGIDAS = new Set([
  "$.attr-btn.forEach(ƒ)", // Fase 8.2: ouvinte morto da criação de personagem (adjustAttr nunca existiu)
]);

class Jogo {
  g: JogoVm;
  t: any;
  passos: string[] = [];
  constructor(js: string, semente: number) {
    this.g = carregarJogo(js, semente, CORRIGIDAS);
    this.t = this.g.t;
    for (const f of this.g.ouvintes.get("DOMContentLoaded") ?? []) f({}); // init() + metaInit()
    this.avancar(200);
    this.t.enterGame(false); // como depois de "Jogar" na tela de título (fecha o título; os atalhos de teclado passam a valer)
    this.avancar(200);
  }
  /** Roda um passo e guarda o resultado (ou o erro) e o estado do jogo logo depois. */
  passo(nome: string, f: () => unknown = () => undefined) {
    let r: string;
    try {
      r = retrato(f()) ?? "undefined";
    } catch (e) {
      r = "ERRO " + String((e as Error)?.message ?? e);
    }
    const t = this.t;
    const estado = {
      d: t.dungeon,
      e: t.econ,
      h: t.world.heroes,
      cps: t.CPS,
      gl: this.listaGL(),
      dom: this.g.escritas(),
    };
    this.passos.push(`${nome} -> ${r}\n${retrato(estado)}`);
  }
  /** O que o último quadro mandou desenhar no WebGL (GL3.list): malha, matriz, cor. Cobre o lado do desenho.
   *  v7.7: as peças do herói (GL3.hero, GL3.port) ficam de fora: o modelo virou a heroína de propósito (outras
   *  articulações, braços e pernas direitos/esquerdos, escudo à parte; ver "correções em relação à v7.6"). */
  listaGL() {
    const GL3 = this.t.GL3,
      nomes = new Map<unknown, string>(),
      heroi = new Set([...Object.values(GL3.hero ?? {}), ...Object.values(GL3.port ?? {})]);
    for (const [k, m] of Object.entries(GL3.mesh)) if (!nomes.has(m)) nomes.set(m, k);
    return GL3.list
      .filter((x: any) => !heroi.has(x.mesh))
      .map((x: any) => [nomes.get(x.mesh) ?? "?", Array.from(x.M ?? []), x.tint && Array.from(x.tint), x.cast]);
  }
  avancar(ms: number) {
    for (let i = 0; i < ms; i += 50) this.g.avancar(Math.min(50, ms - i));
  }
  /** Tecla apertada e solta (vai para os ouvintes de window). */
  tecla(code: string, segurarMs = 0) {
    const ev = (tipo: string) => {
      let parou = false;
      const e = {
        type: tipo,
        code,
        key: code.replace(/^Key/, "").toLowerCase(),
        repeat: false,
        button: 0,
        target: { tagName: "CANVAS" },
        preventDefault() {},
        stopPropagation() {},
        stopImmediatePropagation() {
          parou = true;
        },
      };
      for (const f of this.g.ouvintes.get(tipo) ?? []) {
        if (parou) break;
        f(e);
      }
    };
    ev("keydown");
    if (segurarMs) this.avancar(segurarMs);
    ev("keyup");
  }
  heroi(semente = 12345) {
    const t = this.t,
      h = t.createHero("Teste", t.bornFromSeed(semente));
    t.world.heroes.push(h);
    return h;
  }
  lobo(dx = 20, dy = 0) {
    const t = this.t,
      m = t.spawnDungeonMonster();
    m.x = t.dungeon.px + dx;
    m.y = t.dungeon.py + dy;
    return m;
  }
}

const roteiros: Record<string, Roteiro> = {
  "expedição: espada, flechas, saque, E e saída"(j) {
    const t = j.t,
      h = j.heroi();
    j.passo("entra", () => t.launchDungeon(h.id));
    j.avancar(2000);
    j.passo("dentro");
    j.passo("lobo", () => j.lobo().hp);
    for (let i = 0; i < 14; i++) {
      j.passo("golpe " + i, () => {
        t.dungeon.cd = 0;
        return t.swingBasic();
      });
      j.avancar(350);
    }
    j.passo("troca arma", () => t.switchWeapon());
    j.passo("lobo 2", () => j.lobo(90, 10).hp);
    for (let i = 0; i < 6; i++) {
      j.passo("carrega", () => t.startCharge());
      j.avancar(700);
      j.passo("atira", () => t.fireArrow());
      j.avancar(300);
    }
    j.passo("troca de volta", () => t.switchWeapon());
    for (let i = 0; i < 8; i++) {
      j.passo("E " + i, () => t.interact());
      j.avancar(200);
    }
    j.passo("aparar", () => t.doParry());
    j.avancar(500);
    j.passo("sai", () => t.exitDungeon());
    j.avancar(4000);
    j.passo("fora");
  },
  "luta longa com o laço do jogo rodando (lobos atacam)"(j) {
    const t = j.t,
      h = j.heroi(777);
    t.launchDungeon(h.id);
    j.avancar(2000);
    for (let i = 0; i < 3; i++) j.lobo(40 + i * 25, i * 15);
    for (let s = 0; s < 40; s++) {
      j.passo("t" + s, () => {
        t.dungeon.cd = 0;
        if (s % 3 === 0) t.doParry();
        else t.swingBasic();
      });
      j.avancar(500);
    }
    j.passo("E", () => t.interact());
    j.avancar(30000);
    j.passo("30 s depois");
  },
  "sala de treino (Dungeon Teste)"(j) {
    const t = j.t,
      h = j.heroi(4242);
    j.passo("entra no treino", () => t.launchTraining(h.id));
    j.avancar(2000);
    j.passo("dentro");
    for (let i = 0; i < 10; i++) {
      j.passo("golpe no boneco " + i, () => {
        t.dungeon.cd = 0;
        return t.swingBasic();
      });
      j.avancar(400);
    }
    j.passo("saque no treino", () => t.spawnLoot(t.dungeon.px, t.dungeon.py, true, false));
    j.passo("sai", () => t.exitDungeon());
    j.avancar(4000);
    j.passo("fora");
  },
  "acampamento: fogueira, bigorna, E e saída"(j) {
    const t = j.t,
      h = j.heroi(99);
    j.passo("entra no acampamento", () => t.enterCamp(h));
    j.avancar(2500);
    j.passo("dentro");
    const d = t.dungeon;
    for (const alvo of ["fire", "anvil", "tools", "mesa", "hunter"]) {
      j.passo("vai até " + alvo, () => {
        const p = t.CPS[alvo];
        if (p) {
          d.px = p.x;
          d.py = p.y + 10;
        }
        return t.campNear();
      });
      j.passo("E em " + alvo, () => t.interact());
      j.avancar(600);
      j.passo("fecha", () => {
        d.modalOpen = false;
        t.campClose();
      });
      j.avancar(300);
    }
    j.passo("sai", () => t.exitDungeon());
    j.avancar(4000);
    j.passo("fora");
  },
  "tamanduá e fogueira montada na masmorra; tamanduá no acampamento"(j) {
    const t = j.t,
      h = j.heroi(2024);
    const tam = {
      name: "Tico",
      xp: 0,
      hp: 100,
      sta: 100,
      with: h.id,
      since: 0,
      brushDay: -1,
      feedDay: -1,
      bag: null as unknown,
      coat: "selvagem",
      dirt: 60,
    };
    j.passo("ganha tamanduá", () => void (t.econ.mount = tam));
    j.passo("entra", () => t.launchDungeon(h.id));
    j.avancar(2000);
    j.passo("fogueira", () => {
      const d = t.dungeon;
      (d.fires ??= []).push({ x: d.px + 30, y: d.py + 20, t: 130, max: 130 });
    });
    j.avancar(1500);
    j.passo("acende outra fogueira (Sobrevivência alta: acende direto)", () => {
      h.skills.sobrevivencia = { level: 10, xp: 0 };
      t.fireStart("pedra");
      return [t.econ.fireLv, t.dungeon.fires.length];
    });
    j.passo("E perto do tamanduá", () => t.interact());
    j.avancar(500);
    j.passo("fecha mochila", () => t.toggleInv(false));
    j.passo("monta (T)", () => j.tecla("KeyT"));
    j.avancar(1500);
    j.passo("lobo", () => j.lobo(60).hp);
    for (let i = 0; i < 8; i++) {
      j.passo("golpe " + i, () => {
        t.dungeon.cd = 0;
        return t.swingBasic();
      });
      j.avancar(400);
    }
    j.passo("E na fogueira", () => {
      const d = t.dungeon,
        f = d.fires[0];
      d.px = f.x;
      d.py = f.y + 8;
      return t.interact();
    });
    j.avancar(800);
    j.passo("fecha", () => {
      t.dungeon.modalOpen = false;
      t.campClose();
    });
    j.passo("sai", () => t.exitDungeon());
    j.avancar(4000);
    j.passo("acampamento com o tamanduá", () => t.enterCamp(h));
    j.avancar(2500);
    j.passo("E no tamanduá", () => {
      const d = t.dungeon;
      if (d.mount) {
        d.px = d.mount.x + 10;
        d.py = d.mount.y;
      }
      return t.interact();
    });
    j.avancar(800);
    j.passo("sai", () => t.exitDungeon());
    j.avancar(4000);
    j.passo("fora");
  },
  "acampamento: tutorial do Caçador, acender a fogueira, cozinhar, comer"(j) {
    const t = j.t,
      h = j.heroi(808);
    const fala = (n: number) => {
      for (let i = 0; i < n; i++) {
        j.passo("fala " + i, () => j.tecla(i % 2 ? "Enter" : "Space"));
        j.avancar(400);
      }
    };
    j.passo("prepara", () => {
      t.econ.introDone = true;
      t.econ.hunterCamp = true;
      h.skills.sobrevivencia = { level: 10, xp: 0 };
      h.hunger = 70;
    });
    j.passo("entra no acampamento", () => t.enterCamp(h));
    j.avancar(3000);
    fala(6);
    j.passo("vai à fogueira", () => {
      const d = t.dungeon,
        F = t.CPS.fire;
      d.px = F.x;
      d.py = F.y + 12;
      return t.campNear();
    });
    j.passo("E na fogueira apagada", () => t.interact());
    j.avancar(500);
    j.passo("acende", () => t.fireStart("pedra"));
    j.avancar(2500);
    fala(8);
    j.passo("fecha mochila", () => t.toggleInv(false));
    j.avancar(2000);
    fala(6);
    j.passo("abre a fogueira", () => {
      t.dungeon.modalOpen = false;
      return t.campOpen();
    });
    j.passo("modo de teste (lenha e carne de graça)", () => {
      t.econ.test = true;
      t.tryAddToInv(t.ensureInv(h), "carne", 1);
    });
    j.passo("põe carne", () => t.campAct("cook"));
    for (let i = 0; i < 6; i++) {
      j.avancar(700);
      j.passo("vira " + i, () => t.campAct("flip"));
    }
    j.passo("tira do fogo", () => t.campAct("done"));
    j.avancar(3000);
    j.passo("de novo", () => t.campAct("cook"));
    j.avancar(4000);
    j.passo("tira", () => t.campAct("done"));
    j.avancar(3000);
    j.passo("fecha", () => {
      t.campClose();
      t.econ.test = false;
    });
    j.passo("erva", () => t.healHerb());
    j.passo("vai ao Caçador", () => {
      const d = t.dungeon,
        H = t.CPS.hunter;
      if (H) {
        d.px = H.x;
        d.py = H.y + 10;
      }
      return t.campNear();
    });
    j.passo("E no Caçador", () => t.interact());
    j.avancar(500);
    fala(3);
    j.passo("sai", () => t.exitDungeon());
    j.avancar(4000);
    j.passo("vida no mapa", () => [h.hunger, h.wound, h.hp]);
    j.avancar(20000);
    j.passo("20 s no mapa", () => [Math.round(h.hunger), h.state]);
  },
  "mochila: saque no chão, pegar, mover, pacotes, equipar"(j) {
    const t = j.t,
      h = j.heroi(555);
    j.passo("entra", () => t.launchDungeon(h.id));
    j.avancar(2000);
    j.passo("saque perto", () => {
      const d = t.dungeon;
      t.spawnLoot(d.px + 6, d.py, true, true);
      t.spawnLoot(d.px - 6, d.py + 4, true, false);
      return d.loot.length;
    });
    j.passo("abre a mochila", () => t.toggleInv(true));
    j.avancar(300);
    j.passo("chão → mochila (Ctrl+clique)", () => {
      const g = t.dungeon.gInv;
      const it = g && g.items[0];
      return it ? t.quickMove(it, { inv: g, el: null }) : "nada no chão";
    });
    j.passo("redesenha", () => t.renderInv());
    for (const k of ["pedra", "pedra", "pena", "pedra", "carne", "pena"])
      j.passo("adiciona " + k, () => {
        const ok = t.tryAddToInv(t.ensureInv(h), k, 1);
        t.renderInv();
        return ok;
      });
    j.passo("tira e põe a arma", () => {
      const inv = t.ensureInv(h);
      t.unequip(h, "maoD", inv);
      t.renderInv();
      const arma = inv.items.find((it: any) => it.def.slot === "maoD");
      return arma ? t.equipItem(h, arma, inv) : "sem arma";
    });
    for (let i = 0; i < 6; i++) {
      j.passo("E " + i, () => t.interact());
      j.avancar(150);
    }
    j.passo("fecha", () => t.toggleInv(false));
    j.passo("abre de novo (I)", () => j.tecla("KeyI"));
    j.avancar(300);
    j.passo("fecha (I)", () => j.tecla("KeyI"));
    j.passo("sai pela entrada", () => {
      const d = t.dungeon;
      d.px = d.entrance.x;
      d.py = d.entrance.y;
      return t.interact();
    });
    j.avancar(4000);
    j.passo("fora", () => t.econ.stash.items.length);
  },
  "mãos vazias: faca da mochila, teclado"(j) {
    const t = j.t,
      h = j.heroi(31337);
    j.passo("tira as armas", () => {
      const e = t.ensureEquip(h);
      for (const k of ["maoD", "maoE"]) if (e[k]) t.unequip(h, k, t.ensureInv(h));
    });
    j.passo("entra", () => t.launchDungeon(h.id));
    j.avancar(2000);
    j.passo("lobo", () => j.lobo(18).hp);
    for (let i = 0; i < 8; i++) {
      j.passo("golpe " + i, () => {
        t.dungeon.cd = 0;
        return t.swingBasic();
      });
      j.avancar(400);
    }
    for (const k of ["KeyX", "KeyE", "KeyQ", "KeyH", "KeyI", "KeyI", "KeyG", "KeyT", "KeyF", "Escape"]) {
      j.passo("tecla " + k, () => j.tecla(k, 300));
      j.avancar(200);
    }
    j.passo("sai", () => t.exitDungeon());
    j.avancar(4000);
    j.passo("fora");
  },
  "salvar e carregar: espaço, blob exportado e save do mundo antigo"(j) {
    const t = j.t,
      h = t.createHero("Salva", t.bornFromSeed(4242));
    // o mundo do mapa (bichos, plantas, relógio), que o retrato de cada passo não mostra
    const mundo = () => ({
      tick: Math.round(t.world.tick * 1000),
      bichos: t.world.animals.map((a: any) => [a.species, Math.round(a.x), Math.round(a.y), a.state]),
      plantas: t.world.veg.length,
      quad: t.QUAD.active,
      cam: [t.camera.scale, Math.round(t.camera.tx), Math.round(t.camera.ty)],
    });
    j.passo("xp e ouro", () => {
      t.addHeroXp(h, 300);
      t.econ.gold += 77;
      return [h.lvl, h.xp, t.treePoints(h)];
    });
    j.avancar(3000);
    j.passo("mundo antes", mundo);
    j.passo("salva no espaço 1", () => t.saveTo("1"));
    const blob = t.saveBlob();
    j.passo("bagunça", () => {
      t.econ.gold = 1;
      h.lvl = 99;
      t.world.animals.length = 0;
    });
    j.passo("carrega o espaço 1", () => t.loadFrom("1"));
    j.passo("mundo depois", mundo);
    j.passo("o que muda no blob depois de carregar", () => {
      const a = JSON.parse(blob),
        b = JSON.parse(t.saveBlob()),
        dif = (x: any, y: any) =>
          Object.keys({ ...x, ...y }).filter((k) => JSON.stringify(x[k]) !== JSON.stringify(y[k]));
      return { topo: dif(a, b), world: dif(a.world, b.world), econ: dif(a.econ, b.econ) };
    });
    j.avancar(3000);
    j.passo("o jogo segue", mundo);
    j.passo("blob exportado → applySave", () => t.applySave(JSON.parse(blob)));
    j.passo("mundo do blob", mundo);
    j.passo("save do mundo antigo (K = 1)", () => {
      const d = JSON.parse(blob);
      d.K = 1;
      t.applySave(d);
      return [h.x, h.y, t.world.heroes.map((x: any) => [Math.round(x.camp.x), Math.round(x.camp.y), x.state])];
    });
    j.avancar(1000);
    j.passo("mundo recriado", mundo);
    j.passo("save inválido", () => t.applySave({ world: {} }));
    j.passo("espaço vazio", () => t.loadFrom("3"));
  },
};

function rodar(js: string, r: Roteiro, semente: number) {
  const j = new Jogo(js, semente);
  r(j);
  return { passos: j.passos, erros: j.g.erros.map((e) => String((e as Error)?.stack ?? e).split("\n")[0]) };
}

/** Primeiro passo em que as duas execuções divergem (para a mensagem de erro ficar legível). */
function primeiraDiferenca(a: string[], b: string[]) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    const x = a[i] ?? "",
      y = b[i] ?? "";
    let k = 0;
    while (k < x.length && x[k] === y[k]) k++;
    return `passo ${i} (${x.split("\n")[0]}):\n  ref:  …${x.slice(Math.max(0, k - 80), k + 120)}\n  novo: …${y.slice(Math.max(0, k - 80), k + 120)}`;
  }
  return null;
}

describe("teste diferencial: src/ = referência v7.6 rodando os mesmos roteiros", () => {
  for (const [nome, r] of Object.entries(roteiros)) {
    it(
      nome,
      () => {
        const a = rodar(REF, r, 7),
          b = rodar(NOVO, r, 7);
        expect(a.passos.length).toBeGreaterThan(3);
        expect(primeiraDiferenca(a.passos, b.passos)).toBeNull();
        expect(b.erros).toEqual(a.erros);
      },
      180_000, // a luta longa leva ~50 s sozinha e passa de 60 s com a suíte inteira rodando
    );
  }

  it("o roteiro é determinístico (mesma versão, mesma semente = mesmo resultado)", () => {
    const r = roteiros["luta longa com o laço do jogo rodando (lobos atacam)"];
    expect(primeiraDiferenca(rodar(NOVO, r, 3).passos, rodar(NOVO, r, 3).passos)).toBeNull();
  }, 180_000); // roda o roteiro longo duas vezes: ~70 s nesta máquina
});

// Mudanças de propósito em relação à v7.6: aqui o novo tem que fazer DIFERENTE da referência, do jeito descrito.
describe("correções em relação à v7.6", () => {
  /** Quantas vezes um clique no botão de arma da masmorra troca de arma (toasts "Arma …"). */
  const trocasPorClique = (js: string) => {
    const j = new Jogo(js, 7),
      t = j.t;
    t.launchDungeon(j.heroi().id);
    j.avancar(2000);
    const arma = () => t.dungeon.toasts.filter((x: { text: unknown }) => String(x.text).startsWith("Arma")).length;
    const antes = arma();
    j.g.clicar("dungeon-weapon");
    return arma() - antes;
  };
  it("botão de arma: a v7.6 trocava duas vezes por clique (ouvinte duplicado); agora troca uma", () => {
    expect(trocasPorClique(REF)).toBe(2);
    expect(trocasPorClique(NOVO)).toBe(1);
  }, 60_000);
  it("v7.7 heroína: o herói do campo desenha o modelo novo (tronco, braços e pernas D/E), a v7.6 o antigo", () => {
    const pecas = (js: string) => {
      const j = new Jogo(js, 7),
        t = j.t;
      t.launchDungeon(j.heroi().id);
      j.avancar(2000);
      const P = t.GL3.hero ?? {},
        desenhadas = new Set(t.GL3.list.map((x: { mesh: unknown }) => x.mesh));
      return ["torsoH", "bracoD", "bracoE", "pernaD", "pernaE", "torso", "leg", "armPlain"].filter((k) =>
        desenhadas.has(P[k]),
      );
    };
    expect(pecas(REF)).toEqual(["torso", "leg", "armPlain"]);
    expect(pecas(NOVO)).toEqual(["torsoH", "bracoD", "bracoE", "pernaD", "pernaE"]);
  }, 60_000);
  it("criação de personagem: a v7.6 ligava .attr-btn a adjustAttr (que não existe); o ouvinte morto saiu", () => {
    expect(new Jogo(REF, 7).g.ignoradas).toBe(1);
    expect(new Jogo(NOVO, 7).g.ignoradas).toBe(0);
  }, 60_000);
});
