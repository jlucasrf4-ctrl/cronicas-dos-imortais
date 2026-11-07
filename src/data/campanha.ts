/* ==== v7.7 — campanha "A Runa Selvagem": atos, missões e falas (roteiro em docs/campanha.md) ====
   Tudo o que é texto e ordem da campanha mora aqui; a lógica está em campanha/campanha.ts. Uma missão termina quando
   o jogo avisa o evento dela (campanhaEvento("<evento>")) e passa para a `proxima`. Um evento de uma missão mais
   adiante na corrente também vale: as do meio contam como feitas (jogador que pulou um pedaço não trava).
   v8.0 (mantenedor, 2026-10-24: "a missão do lobo atrasa a história"): duas correntes. A principal leva à vila; a dos
   lobos (`linha: "lobos"`: cuidar, pedidos, casal, filhote) abre com `abre` e corre ao lado, sem travar a outra. */

/** Os atos do roteiro (o número que aparece no objetivo). */
export const ATOS: Record<number, string> = {
  1: "Chegada",
  2: "O ciclo",
  3: "Lições do Caçador",
  4: "A estrada",
  5: "Noite na vila",
  6: "Manhã na vila",
  7: "A igreja",
  8: "Rastros",
  9: "Preparação",
  10: "A Runa Selvagem",
  11: "A Agulha",
  12: "O Palácio",
};

export interface Missao {
  ato: number;
  /** Título curto (negrito no objetivo). */
  titulo: string;
  /** O que fazer agora (linha de baixo). */
  objetivo: string;
  /** Evento que conclui; "" = ainda sem conteúdo (fim do que está pronto, fica na tela até o próximo ato existir). */
  conclui: string;
  proxima: string | null;
  /** v7.7 — o Caçador chama: "❗" sobre ele (e no balão do acampamento no mapa); falar com ele diz esta fala de FALAS
      e conclui a missão. */
  chamado?: string;
  /** v7.7 — com um pedido de carne em aberto, o objetivo mostra o pedido (campanha/pedidos.ts). */
  pedido?: boolean;
  /** v7.7 — no fim da fala do `chamado`, o acampamento aprende a forjar esta peça (forgeLearn). */
  aprende?: string;
  /** v8.0 — dicas da aba de missões (campanha/diario.ts): como fazer o objetivo. */
  dicas?: string[];
  /** v8.0 — no fim da fala do `chamado`, liga esta marca em econ.campanha.flags (ex.: "boteFurado"). */
  marca?: string;
  /** v8.0 — missão da linha paralela (econ.campanha.paralela), não da corrente principal. */
  linha?: "lobos";
  /** v8.0 — ao concluir, abre a linha paralela nesta missão. */
  abre?: string;
}

/** v8.0 — nome de cada linha paralela (quadro do objetivo e diário). */
export const LINHAS: Record<string, string> = { lobos: "Os lobos do Caçador" };

/** As missões, na ordem da corrente (a primeira é a de um jogo novo). */
export const MISSOES: Record<string, Missao> = {
  a1_abertura: {
    ato: 1,
    titulo: "Sobreviver",
    objetivo: "Siga o Caçador na floresta",
    conclui: "introFim",
    proxima: "a1_acampamento",
    dicas: ["Faça o que o Caçador pedir: ele ensina a se curar, juntar material e fazer flechas."],
  },
  a1_acampamento: {
    ato: 1,
    titulo: "O acampamento",
    objetivo: "Vá ao acampamento do Caçador, ao norte",
    conclui: "acampamentoChegou",
    proxima: "a1_noite",
    dicas: [
      "O acampamento fica ao norte (para cima).",
      "No mapa: clique na heroína para selecionar e clique com o botão direito no acampamento para ir até lá.",
    ],
  },
  a1_noite: {
    ato: 1,
    titulo: "Primeira noite",
    objetivo: "Ajude o Caçador: fogueira e jantar",
    conclui: "acampamentoFim",
    proxima: "a2_livre",
    dicas: ["Chegue perto da fogueira e aperte E para acender.", "Asse a carne na fogueira e monte a barraca."],
  },
  a2_livre: {
    ato: 2,
    titulo: "Tempo livre",
    objetivo: "O Caçador está cochilando · explore e, à noite, durma na barraca",
    conclui: "dormiu",
    proxima: "a3_brasa",
    dicas: [
      "Saia em expedições: caçar, juntar galhos e pedras, achar itens no chão.",
      "Volte antes de escurecer. De noite (depois das 19h30), aperte Z perto da barraca para dormir.",
    ],
  },
  /* v7.7 — Ato 3: os lobos (docs/campanha.md, C2) */
  a3_brasa: {
    ato: 3,
    titulo: "O Caçador chama",
    objetivo: "Fale com o Caçador no acampamento",
    conclui: "falouBrasa",
    proxima: "a3_lobo",
    dicas: ["O ❗ amarelo mostra que o Caçador quer falar. Chegue perto dele e aperte E."],
    chamado: "cacador_brasa",
  },
  a3_lobo: {
    ato: 3,
    titulo: "Um lobo vivo",
    objetivo: "Numa expedição, lace um lobo, canse-o até cair e espere ele levantar na corda · sem matar",
    conclui: "loboDerrubado",
    proxima: "a3_carregar",
    dicas: [
      "Clique no lobo para marcar o foco e aperte G para jogar a corda.",
      "Segure a corda até ele cair de cansaço. Não finalize com a faca: espere ele levantar ainda na corda.",
    ],
  },
  a3_carregar: {
    ato: 3,
    titulo: "Um lobo vivo",
    objetivo: "Leve o lobo pela corda até a saída do campo",
    conclui: "loboCarregado",
    proxima: "a3_cercado",
    dicas: [
      "Domado, ele ainda dá pinotes: segure firme até ele desistir.",
      "Se a corda soltar, a missão volta para laçar de novo.",
    ],
  },
  a3_cercado: {
    ato: 3,
    titulo: "Um lobo vivo",
    objetivo: "Volte ao acampamento e fale com o Caçador",
    conclui: "falouLoboVivo",
    proxima: "a3_costura",
    abre: "a3_espera", // v8.0: cuidar dos lobos vira linha paralela
    dicas: ["No mapa, o balão do acampamento mostra ❗ quando o Caçador quer falar."],
    chamado: "cacador_lobo_vivo",
  },
  /* v8.0 — linha paralela dos lobos: do cercado ao filhote (não trava a corrente principal) */
  a3_espera: {
    ato: 3,
    linha: "lobos",
    titulo: "O cercado",
    objetivo: "Veja o lobo no cercado, à direita do acampamento",
    conclui: "cercadoVisto",
    proxima: "a3_alimentar",
    dicas: ["O cercado fica à direita da fogueira, acima da bigorna."],
  },
  a3_alimentar: {
    ato: 3,
    linha: "lobos",
    titulo: "O cercado",
    objetivo: "Dê carne ao lobo (E na cerca) · o Caçador também cuida dele todo dia",
    conclui: "loboAlimentado",
    proxima: "a3_vinculo",
    dicas: ["Leve carne (crua ou assada) na mochila e aperte E perto do lobo ou da cerca."],
  },
  a3_vinculo: {
    ato: 3,
    linha: "lobos",
    titulo: "O cercado",
    objetivo: "Dê carne ao lobo até ele se acostumar (vínculo 2/4) · aí o Caçador vai pedir carne",
    conclui: "pedidoAnunciado",
    proxima: "a3_pedido",
    dicas: [
      "Cada lobo come uma carne da sua mão por dia. O Caçador também trata dele todo dia.",
      "Dormir faz os dias passarem mais rápido.",
    ],
  },
  a3_pedido: {
    ato: 3,
    linha: "lobos",
    titulo: "Carne para os lobos",
    objetivo: "Leve ao Caçador a carne que ele pediu",
    conclui: "pedidoEntregue",
    proxima: "a3_cuidar",
    pedido: true,
    dicas: [
      "Finalizar o bicho com a faca (E quando ele cai) dá carne e pele de qualidade melhor.",
      "Com a carne certa na mochila, aperte E perto do Caçador para entregar.",
    ],
  },
  /* v7.7 — passo 3b: a costura (a roupa rasgou na luta do lobo) */
  a3_costura: {
    ato: 3,
    titulo: "Roupa de caçador",
    objetivo: "O Caçador quer falar sobre a sua roupa",
    conclui: "falouCostura",
    proxima: "a3_armadura",
    dicas: ["Chegue perto do Caçador (❗) e aperte E."],
    chamado: "cacador_costura",
    aprende: "eq_armadura",
  },
  a3_armadura: {
    ato: 3,
    titulo: "Roupa de caçador",
    objetivo: "Faça a armadura de couro na bigorna · 3 peles",
    conclui: "forjou_eq_armadura",
    proxima: "a4_vila", // v8.0: a corrente principal segue para a vila; os lobos continuam na linha paralela
    dicas: [
      "Peles vêm dos bichos abatidos. Finalizar com a faca aumenta a chance de pele inteira.",
      "Leve as 3 peles até a bigorna do acampamento e aperte E.",
    ],
  },
  a3_cuidar: {
    ato: 3,
    linha: "lobos",
    titulo: "Os lobos do Caçador",
    objetivo: "Quando ele chamar (❗), leve a carne que pedir · os lobos ganham vínculo",
    conclui: "filhoteNasceu",
    proxima: "a3_filhote",
    pedido: true,
    dicas: [
      "Uns dias depois, o Caçador traz um segundo lobo para formar o casal.",
      "Com o casal no vínculo 4/4, nasce um filhote. Afague e alimente os lobos para o vínculo subir.",
    ],
  },
  /* v7.7 — passo 4: o casal (o segundo lobo o Caçador traz sozinho), o filhote e soltar os pais */
  a3_filhote: {
    ato: 3,
    linha: "lobos",
    titulo: "O filhote",
    objetivo: "Nasceu o filhote · o Caçador quer falar",
    conclui: "falouFilhote",
    proxima: "a3_soltar",
    dicas: ["Chegue perto do Caçador (❗) e aperte E."],
    chamado: "cacador_filhote",
  },
  a3_soltar: {
    ato: 3,
    linha: "lobos",
    titulo: "O filhote",
    objetivo: "Solte os pais do cercado (E na cerca) · em até 2 dias",
    conclui: "paisSoltos",
    proxima: "a3_cria",
    dicas: [
      "Aperte E perto de um dos pais e escolha Soltar.",
      "O filhote precisa crescer longe dos pais, senão vira lobo e não cão. Depois de 2 dias, o Caçador solta por você.",
    ],
  },
  a3_cria: {
    ato: 3,
    linha: "lobos",
    titulo: "O filhote do Caçador",
    objetivo: "O filhote cresce no cercado, longe dos pais · durma esta noite",
    conclui: "noiteCria", // v8.0: dormir com esta missão (campanha/sono.ts); fecha a linha dos lobos
    proxima: null,
    pedido: true,
    dicas: [
      "Continue atendendo os pedidos de carne do Caçador.",
      "Você também pode laçar seus próprios lobos e criar o seu casal no mesmo cercado.",
      "De noite, durma na barraca (Z) ou na taverna.",
    ],
  },
  /* v8.0 — Ato 4: a estrada (ponte do Ato 3; mantenedor, 2026-10-24: "logo depois do Ato 3, ou quando juntar 100 em
     gold no baú" → o aviso dos 100 é campanha/campanha.ts avisoBau) */
  a4_vila: {
    ato: 4,
    titulo: "A estrada",
    objetivo: "O Caçador quer falar",
    conclui: "falouVila",
    proxima: "a4_vender",
    dicas: ["Chegue perto do Caçador (❗) e aperte E."],
    chamado: "cacador_vila",
    marca: "boteFurado",
  },
  a4_vender: {
    ato: 4,
    titulo: "Vender na vila",
    objetivo: "Leve peles e carne a pé até a Vila Musgo e venda no Empório",
    conclui: "vendeuVila",
    proxima: "a5_taverna",
    dicas: [
      "Pegue no baú do acampamento o que for vender e ponha na mochila.",
      "No mapa, selecione a heroína e clique com o botão direito na Vila Musgo para ir a pé.",
      "O bote está furado: até consertarem, o caminho é a pé.",
      "Peles e carne de qualidade melhor (abate limpo) valem mais.",
    ],
  },
  /* v8.0 — Atos 5 a 7 na vila em janela (map/vila.ts: abas Taverna, Quadro, Doca, Igreja do Empório) */
  a5_taverna: {
    ato: 5,
    titulo: "Noite na vila",
    objetivo: "Na vila, abra a aba Taverna e converse com o taverneiro",
    conclui: "ouviuBoato",
    proxima: "a6_doca",
    dicas: [
      "Clique na Vila Musgo com a heroína lá para abrir a janela da vila.",
      "Na taverna também dá para dormir pagando, longe do acampamento.",
    ],
  },
  a6_doca: {
    ato: 6,
    titulo: "O bote furado",
    objetivo: "Na aba Doca, leve ao barqueiro 8 galhos e 20 de ouro para consertar o bote",
    conclui: "boteEntregue",
    proxima: "a6_espera",
    dicas: [
      "Galhos se juntam no chão do campo (E) ou cortando árvores.",
      "O Quadro de missões da vila paga ouro por entregas simples.",
    ],
  },
  a6_espera: {
    ato: 6,
    titulo: "O bote furado",
    objetivo: "O barqueiro conserta o bote em 2 dias · enquanto isso, conheça a igreja",
    conclui: "falouImortal",
    proxima: "a7_cavaleiros",
    dicas: ["Na aba Igreja, fale com o Imortal.", "Dormir (no acampamento ou na taverna) faz os dias passarem."],
  },
  a7_cavaleiros: {
    ato: 7,
    titulo: "A Runa Selvagem",
    objetivo: "Os cavaleiros partem atrás da Lebre Rúnica · a campanha continua em breve",
    conclui: "",
    proxima: null,
    dicas: [
      "Quando o bote ficar pronto, a doca da vila leva de volta à área de caça.",
      "Junte ouro e equipamento: a caçada da Lebre Rúnica vem aí.",
    ],
  },
};
export const MISSAO_INICIAL = "a1_abertura";

/** Quem fala: nome e o rosto (emoji) da caixa de diálogo. */
export const FALANTES: Record<string, { nome: string; ava: string }> = {
  cacador: { nome: "Caçador", ava: "🏹" },
  taverneiro: { nome: "Taverneiro", ava: "🍺" }, // v8.0: a vila (map/vila.ts)
  barqueiro: { nome: "Barqueiro", ava: "⛵" },
  imortal: { nome: "O Imortal", ava: "✨" },
};

/** Uma fala: quem e as páginas (cada página = linhas que aparecem uma por vez). */
interface Fala {
  quem: string;
  paginas: string[][];
}
export const FALAS: Record<string, Fala> = {
  cacador_chegada: {
    quem: "cacador",
    paginas: [
      ["Você está aí!", "Chegou em boa hora."],
      ["Estou com as mãos molhadas, acabei de limpar o javali.", "Pode acender a fogueira?"],
    ],
  },
  cacador_barraca: {
    quem: "cacador",
    paginas: [
      ["Jovem, estamos bem longe da cidade.", "Creio que não vai conseguir chegar hoje."],
      ["Eu tenho uma barraca velha. Você pode montar aqui no acampamento."],
      ["Eu fiz desse lugar uma base temporária. Está seguro aqui."],
      ["Agora vou tirar um cochilo. Fique à vontade…", "…faça pouco barulho. Tenho sono leve."],
    ],
  },
  /* v7.7 — Ato 3: por que ele quer um lobo (proposta de 2026-10-18, aguardando o OK do mantenedor) */
  cacador_brasa: {
    quem: "cacador",
    paginas: [
      ["A Brasa, minha cadela, era meio-loba.", "Farejava pato no meio do junco antes dele levantar voo."],
      ["Morreu no inverno passado."],
      ["Na vila só tem cachorro de quintal, que late e espanta tudo.", "Cão de caça bom vem da capital…"],
      ["…e isso é longe demais pra mim."],
      ["Meu avô criava os dele com lobo.", "Pegava um casal, cuidava até perderem o medo…"],
      ["…e o filhote já nascia acostumado com gente."],
      ["Quero tentar igual. Mas laçar lobo sozinho… não dá.", "Me ajuda? Vivo, hein."],
    ],
  },
  /* v7.7 — passo 1b da C2: o lobo trazido vivo */
  cacador_lobo_vivo: {
    quem: "cacador",
    paginas: [
      ["Você trouxe ele vivo!", "E nem está tão machucado. Bom trabalho."],
      ["Vou fechar um canto ali com estaca e corda.", "Lobo preso fica bravo, então de longe por enquanto."],
      ["Amanhã ele vai estar com fome.", "E eu vou precisar de carne boa."],
    ],
  },
  /* v7.7 — passo 4: o filhote nasceu */
  cacador_filhote: {
    quem: "cacador",
    paginas: [
      ["Nasceu! Olha só o tamanho desse pequeno.", "Agora vem a parte difícil."],
      ["Os pais têm que ir embora.", "Se ele cresce vendo os dois, vira lobo também."],
      ["Me ajuda a soltar os dois?", "Tem que ser logo. Dois dias, no máximo."],
    ],
  },
  /* v8.0 — Ato 4: o Caçador manda vender na vila (a pé: o bote está furado até a doca consertar, Ato 6) */
  cacador_vila: {
    quem: "cacador",
    paginas: [
      // v8.0: vem logo depois da armadura (antes vinha depois do filhote); proposta, aguardando o OK do mantenedor
      ["Ficou bem em você, essa armadura.", "Agora lobo nenhum te rasga à toa."],
      ["Mas olha esse baú: pele e carne demais.", "Carne apodrece, pele mofa. Isso tem que virar ouro."],
      ["Leva até a Vila Musgo e vende no empório.", "Lá pagam bem por pele e carne de abate limpo."],
      ["Ah, e vai a pé: o bote está furado.", "O pessoal da doca da vila sabe consertar, mas cobra caro."],
    ],
  },
  /* v8.0 — a vila (map/vila.ts mostra estas falas dentro da janela da vila) */
  taverna_boato: {
    quem: "taverneiro",
    paginas: [
      ["Forasteira, é? Senta. A primeira caneca é por conta da casa.", "Veio do acampamento do velho Caçador?"],
      ["Então já ouviu falar da Runa Selvagem.", "Dizem que apareceu no norte, perto do vale."],
      ["Runa natural: nasce sozinha, sem ninguém forjar.", "Os antigos faziam artefatos com elas. Coisa de lenda."],
      ["Hoje chegaram dois cavaleiros do norte. Foram direto à igreja.", "Gente assim não viaja à toa."],
    ],
  },
  doca_pedido: {
    quem: "barqueiro",
    paginas: [
      ["Esse bote aí é do Caçador? Furado feito peneira.", "Conserto, sim. Mas madeira não nasce na doca."],
      ["Me traz 8 galhos e 20 de ouro.", "Em dois dias ele está boiando de novo."],
    ],
  },
  doca_conserto: {
    quem: "barqueiro",
    paginas: [["Madeira boa. Deixa comigo.", "Volta em dois dias. Nem um a menos."]],
  },
  igreja_imortal: {
    quem: "imortal",
    paginas: [
      ["Entre. Não precisa ter medo de mim.", "Faz tempo que alguém de fora não pisa nesta igreja."],
      ["Deixe-me ver você.", "{afinidade}"],
      [
        "Estes dois cavaleiros vieram do norte atrás da Runa Selvagem.",
        "Ela não está numa pedra: está num bicho. Uma lebre.",
      ],
      ["Uma Lebre Rúnica não se caça com flecha comum.", "Prepare-se. Quando estiver pronta, volte a falar comigo."],
    ],
  },
  /* v7.7 — passo 3b: a costura (no fim, o acampamento aprende a armadura de couro: `aprende` da missão) */
  cacador_costura: {
    quem: "cacador",
    paginas: [
      ["Vi o estrago que aquele lobo fez na sua roupa.", "Pano não segura dente."],
      ["Couro segura. Vou te ensinar a cortar e costurar.", "É na bigorna mesmo: corta a peça, depois costura."],
      ["Junta três peles e faz a sua.", "Lobo, cervo… pele de bicho que você mesmo pegou."],
    ],
  },
};

/** v7.7 — o que o Caçador diz na hora (frase curta sobre a cabeça dele ou um letreiro), por momento da campanha. */
export const FALAS_CURTAS: Record<string, string> = {
  loboCaido: "Chegue perto e finalize com a faca (E) · ou espere ele levantar na corda: fica domado",
  loboDomado: "Leve o lobo pela corda até a saída do campo",
  loboAbatido: "Pele bonita, corte limpo… mas eu precisava dele vivo. Lace outro.",
  loboFugiu: "O lobo escapou da corda. Lace outro.",
  roupaRasgou: "A mordida rasgou a sua roupa!",
  segundoLobo: "O Caçador laçou {um} e pôs no cercado",
  paisSoltos: "Os pais foram embora · o filhote fica",
  cacadorSoltou: "O Caçador soltou os pais do filhote",
};
