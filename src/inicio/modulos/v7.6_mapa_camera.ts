/* ==== Fase 4 — código de carga do antigo src/js/modulos/v7.6_mapa_camera.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarMapaCamera() na ordem do antigo manifesto. */
import { TELAS, dungeon, econ } from "../../core/state.ts";
import { SEGUIR, segueBtn, vp0 } from "../../map/camera.ts";
import { heroNaVila, musgoCity } from "../../map/vila_musgo.ts";
import { mapHero } from "../../map/controle.ts";
import { entrarNoCampo, sairDoCampo } from "../../map/transicao.ts";

export function iniciarMapaCamera() {
  document.addEventListener("mv:mobile-world-transition", () => {
    if (dungeon.active) {
      sairDoCampo();
      return;
    }
    const h = mapHero();
    if (h) entrarNoCampo(h);
  });
  /* ==== v7.6 — mapa: câmera segue o personagem · névoa no lugar do limite de zoom · anel da rodinha para entrar no campo · caminho até o destino ==== */
  /* arrastar o mapa (no toque) solta a câmera */
  {
    document.addEventListener(
      "pointerdown",
      (e) => {
        const vp = vp0();
        if (vp && vp.contains(e.target as Node) && !dungeon.active) TELAS.d0 = { x: e.clientX, y: e.clientY };
      },
      true,
    );
    document.addEventListener(
      "pointermove",
      (e) => {
        if (!TELAS.d0 || !e.buttons || e.pointerType === "mouse") return; // v7.7: no mouse, quem solta é o RTS (map/selecao.ts)
        if (Math.hypot(e.clientX - TELAS.d0.x, e.clientY - TELAS.d0.y) > 8) {
          SEGUIR.solto = true;
          segueBtn(true);
          TELAS.d0 = null;
        }
      },
      true,
    );
    document.addEventListener(
      "pointerup",
      () => {
        TELAS.d0 = null;
      },
      true,
    );
    // v7.7: WASD agora move a câmera e solta a heroína; Espaço centraliza e F liga o seguir (map/selecao.ts)
  }
  // v7.7: a câmera começa livre (RTS) e só segue com F; andar não a prende mais
  SEGUIR.solto = true;
  /* sem parede de zoom: dá para afastar até o mapa todo, mas o que está longe fica na névoa */
  setInterval(() => {
    try {
      const v = musgoCity(),
        h = heroNaVila();
      if (v && h) econ.musgoVisto = 1;
    } catch (_) {}
  }, 1000);
  // v7.7: a camada de cima do mapa (névoa, caminho até o destino, anel da rodinha) e a câmera seguindo a heroína, que
  // eram um requestAnimationFrame próprio aqui (mapfx2Loop), rodam no laço principal na mesma câmera do desenho
  // (map/quadro.ts: antesDoDesenhoMapa, desenharCamadaMapa)
}
