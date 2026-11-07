/* ==== v8.1 — o palco da criação (render/retrato.ts glRetratoCriacao, ui/criacao.ts) ====
   Mantenedor 2026-10-31: abre em close no rosto e no busto; clicar mostra o corpo inteiro com uma demonstração em laço
   (espada, machado numa arvorezinha, tiro com o arco — a lança saiu: "ficou feia"); clicar de novo volta ao close.
   Distâncias no mundo do retrato (a personagem na origem, ~56 de altura, escala 1,3); tempos em segundos. */
export const PALCO_CRIACAO = {
  close: { alvo: [0, 48, 0], olho: [46, 50, 0], yaw: -0.25 }, // v8.1: mais perto (o rosto enche o quadro)
  inteira: { alvo: [0, 32, 0], olho: [200, 52, 0], yaw: 0.7 }, // de lado (3/4): a árvore e a flecha à vista
  transicao: 3.5, // velocidade da câmera atrás do alvo (1/s, exponencial)
  // o jogo de câmera do arco: puxando e mirando, chega perto do tronco dela; solta, segue a flecha em câmera lenta e
  // para (a flecha some no fundo); `seguir` = quanto o alvo vai da personagem para a flecha; `para` = s de voo até parar
  camArco: { mira: { alvoY: 46, dist: 100 }, voo: { dist: 150, seguir: 0.7, para: 0.4, lenta: 0.3, tLenta: 0.3 } },
  respiro: 0.7, // parada entre uma ação e a outra
  espada: { golpe: 0.62, entre: 0.12, arma: "eq_espada" }, // cada passo do combo (os 0,38 s do jogo, mais devagar)
  machado: { carga: 0.55, segura: 0.18, golpe: 0.32, entre: 0.35, vezes: 2, acerto: 0.55, arma: "eq_machado" },
  arvore: { x: 21, z: 0, tam: 1.55, balanco: 0.1, folhas: 9 }, // na frente dela (modelo, antes da escala); mais alta que ela
  // puxa a corda, segura mirando, solta; a flecha (comp = mundo) voa com `vel`/`queda` (mundo/s, mundo/s²)
  arco: { puxa: 0.75, mira: 0.55, voo: 1.3, vel: 230, queda: 30, comp: 35, arma: "eq_arco" },
};
/** A ordem fixa da demonstração (e os ícones das marquinhas para pular direto). */
export const ACOES_CRIACAO = [
  { id: "espada", ico: "⚔", nome: "Espada" },
  { id: "machado", ico: "🪓", nome: "Cortar árvore" },
  { id: "arco", ico: "🏹", nome: "Atirar com o arco" },
] as const;
