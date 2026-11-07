/* ==== Fase 4 ====
   ícones: emojis dos avisos e da HUD, e qual arte pintada (.ico-<chave>) cada coisa usa: atributos, botões,
   criaturas, molduras de qualidade, sinergias, materiais, armas (normal e gasta). Saíram de v4.7, v5.2, v5.9.07,
   v5.9.13 e v6.3 */

export const TOAST_ICONS: [RegExp, string, string?][] = [
  [/^Bloqueado$/, "🛡️", "#9fe3ff"],
  [/^Esquivou/, "💨"],
  [/^Desviou!$/, "💨"],
  [/^Parry parcial$/, "⚡", "#ffb347"],
  [/^Parry!$/, "⚡", "#ffe08a"],
  [/^Defesa fraca/, "🛡️💢"],
  [/^Errou$/, "✖", "#c9b88a"],
  [/^Zona segura!$/, "🟢"],
  [/^Pelas costas!$/, "❗"],
  [/^Carga fraca$/, "🏹⬇"],
  [/^Perdeu a mira$/, "🎯✖"],
  [/^Nada para interagir aqui$/, ""],
  [/^Vida cheia$/, "❤️"],
  [/^Sem ervas na mochila$/, "🌿✖"],
  [/^Sem fôlego pra correr$/, "💨✖"],
  [/^Fôlego acabou!$/, "💨✖"],
  [/^Sem arco equipado$/, "🏹✖"],
  [/^Sem escudo equipado$/, "🛡️✖"],
  [/^Sem flechas!/, "🏹✖"],
  [/^Mochila cheia!$/, "🎒✖"],
  [/^Mochila e aljava cheias!$/, "🎒✖"],
  [/^Guarda quebrou!$/, "🛡️💥"],
  [/^Atordoou!$/, "💫"],
  [/^Empurrado!$/, "💨"],
  [/^Acuado!$/, "❗"],
  [/^Lobo fugindo!$/, "🐾"],
  [/^Lobo desesperado!$/, "😡"],
  [/^O Alfa enlouqueceu!$/, "😡"],
  [/^Rastreado$/, "🐾"],
  [/^Marcado x/, "🎯"],
  [/^Você se revelou!$/, "👁️"],
  [/^Invulnerável!$/, "✨"],
  [/^A runa bruta queima a pele!$/, "🔥"],
  [/^Contra-ataque!$/, "⚔️"],
  [/^CONTRA-GOLPE!$/, "⚔️"],
  [/^Vá até a SAÍDA verde/, "🚪⬅"],
  [/^A Runa Natural se apagou$/, "✨💨"],
  [/^Esquivou o bote!$/, "💨"],
  [/^Defesa fraca −30%$/, "🛡️💢"],
  [/^Carga fraca$/, "🏹⬇"],
  [/^🌿 regenerando/, "🌿"],
];
export const BANNER_SUBS: [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
  [/^3 hordas e um chefe/, "🐺 ×3  ·  👑"],
  [/^(\d+) lobos( \+ 1 javalino)?$/, (m) => "🐺×" + m[1] + (m[2] ? "  🐗×1" : "")],
  [/^Muito mais vida/, ""],
  [/^Você tem 1 min para coletar/, "⏱ 1:00  ·  🎒  ·  🚪 E"],
  [/^Os lobos vão aparecendo/, "🚪 E"],
  [/^Saia pelo círculo verde/, "🚪 E"],
  [/^Próxima horda em 7s/, "⏱ 7s"],
  [/^Prepare-se$/, ""],
  [/^Lobos de reforço chegaram$/, "🐺🐺"],
  [/^Abra a Ficha/, "📜 K"],
];
/* barra de botões da masmorra: ícone + tecla (o texto completo fica no "title") */
export const HUD_ICONS: Record<string, string[]> = {
  "dungeon-weapon": ["⚔", "Q"],
  "dungeon-attack": ["🗡", "F"],
  "dungeon-interact": ["✋", "E"],
  "dungeon-craft": ["🔨", "C"],
  "dungeon-guard": ["🛡", "Espaço"],
  "dungeon-parry": ["⚡", "🖱 dir."],
  "dungeon-herb": ["🌿", "H"],
  "dungeon-bag": ["🎒", "I"],
  "dungeon-sheet": ["📜", "K"],
};
// itens compridos (espada, lança, arco…) ficam na diagonal na arte: na peça comprida do inventário, giramos para preencher
export const ICO_DIAG: Record<string, number> = {
  eq_espada: -45,
  eq_espada_longa: 45,
  eq_lanca: -45,
  eq_clava: -45,
  eq_machado: -45,
  eq_picareta: -45,
  eq_arco: -45,
  eq_arco_longo: -45,
  galho: -45,
  pena: -45,
  penaag: -45,
};
// atributos
export const ATTR_ICO: Record<string, string> = {
  forca: "attr_forca",
  constituicao: "attr_constituicao",
  destreza: "attr_destreza",
  velocidade: "attr_velocidade",
  mana: "attr_mana",
  vida: "attr_vida",
};
// botões da masmorra (PC)
export const HUD_ICO_K: Record<string, string> = {
  "dungeon-attack": "btn_atacar",
  "dungeon-interact": "btn_interagir",
  "dungeon-craft": "btn_craft",
  "dungeon-guard": "btn_defender",
  "dungeon-parry": "btn_parry",
  "dungeon-herb": "btn_erva",
  "dungeon-bag": "btn_mochila",
  "dungeon-sheet": "btn_ficha",
};
export const TOAST_ICO: Record<string, string[]> = {
  "💥": ["fx_critico"],
  "🩸": ["fx_sangramento"],
  "💫": ["fx_atordoado"],
  "🐌": ["fx_lento"],
  "💨": ["fx_esquiva"],
  "⚡": ["fx_parry_perfeito"],
  "🛡️💥": ["fx_guarda_quebrou"],
  "✨": ["fx_invulneravel"],
  "🎯": ["fx_marcado"],
  "👁️": ["fx_revelado"],
  "❗": ["fx_alerta"],
  "😡": ["fx_furia"],
  "❤️": ["fx_vida_cheia"],
  "🟢": ["fx_zona_segura"],
  "⚔️": ["fx_contragolpe"],
  "🛡️": ["fx_bloqueio"],
  "🐾": ["no_rastreador"],
  "🌿": ["btn_erva"],
  "✖": ["overlay_x"],
  "🚪⬅": ["ui_saida", "overlay_baixo"],
  "🔱": ["eq_lanca"],
  "📜 K": ["btn_ficha"],
  "🏹✖": ["eq_arco", "overlay_x"],
  "🎒✖": ["btn_mochila", "overlay_x"],
  "🌿✖": ["btn_erva", "overlay_x"],
  "💨✖": ["fx_esquiva", "overlay_x"],
  "🛡️✖": ["btn_defender", "overlay_x"],
  "🎯✖": ["fx_marcado", "overlay_x"],
  "🏹⬇": ["eq_arco", "overlay_baixo"],
  "🛡️💢": ["btn_defender", "overlay_baixo"],
  "✨💨": ["fx_invulneravel", "overlay_baixo"],
  "🐺🐺": ["cr_lobo"],
};
// retrato da criatura no painel de detalhes
export const CR_ICO: Record<string, string> = {
  rabbit: "cr_coelho",
  deer: "cr_cervo",
  duck: "cr_pato",
  eagle: "cr_aguia",
  fox: "cr_raposa",
  wolf: "cr_lobo",
  bird: "cr_passaro",
  boar: "cr_javalino",
};
// molduras de qualidade atrás do equipamento no inventário
export const Q_FRAME: (string | null)[] = ["moldura_ruim", "moldura_comum", "moldura_comum", "moldura_excelente"];
export const SYN_ICO: Record<string, string> = {
  sangue_marcado: "sin_faro_sangue",
  predador_paciente: "sin_predador_paciente",
  danca_do_escudo: "sin_danca_escudo",
};
export const PX_N: Record<string, number> = {
  pedra: 13,
  quartzo: 4,
  ametista: 8,
  ferro: 4,
  jaspe: 12,
  citrino: 12,
  lapis: 11,
  quartzo_rosa: 11,
  malaquita: 8,
  agata: 4,
  serpentina: 4,
  obsidiana: 4,
  prata: 2,
};
// v7.7 — runa absorvida (runa_<grau>_<elemento>_…) → ícone rn_<elemento>_<n>: 1 bruta, 2 meio lapidada, 3 polida
// (os ícones e as pedras px_* saem de tools/gerar-icones-pedras.ts)
export const RUNA_ICO: Record<string, number> = { fraturada: 1, capturada: 2, preciosa: 3, liq: 3 };
export const MAT_ICO: Record<string, string> = {
  carne: "meat",
  erva: "erva",
  pele: "pele",
  galho: "madeira",
  pedra: "pedra",
  ferro: "minerio",
  presa: "osso",
};
export const FX_ICO: Record<string, string> = { stone: "pedra", feather: "pena", eagle: "penaag" };
export const WX_N: Record<string, number> = {
  wx_faca: 70,
  wx_machado: 24,
  wx_machado2: 10,
  wx_espada: 17,
  wx_espadal: 16,
  wx_facaq: 18,
  wx_espadaq: 17,
  wx_espadalq: 17,
  wx_machadoq: 11,
  wx_lanca: 21,
  wx_lancaq: 18,
};
export const WX: Record<string, string[]> = {
  // item → [arte normal, arte gasta/quebrada]
  eq_faca: ["wx_faca", "wx_facaq"],
  eq_faca_velha: ["wx_facaq", "wx_facaq"],
  eq_faca_simples: ["wx_facaq", "wx_facaq"],
  eq_espada: ["wx_espada", "wx_espadaq"],
  eq_espada_longa: ["wx_espadal", "wx_espadalq"],
  eq_machado: ["wx_machado", "wx_machadoq"],
  eq_lanca: ["wx_lanca", "wx_lancaq"],
};
export const WX_GASTA = 0.3; // abaixo de 30% de durabilidade a arma aparece gasta/quebrada
