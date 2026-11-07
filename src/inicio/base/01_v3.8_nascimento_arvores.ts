/* ==== Fase 4 — código de carga do antigo src/js/base/01_v3.8_nascimento_arvores.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarNascimentoArvores() na ordem do antigo manifesto. */
import { renderHabitat } from "../../ui/painel.ts";

export function iniciarNascimentoArvores() {
  /* ---------------------------------------------------------------------
     2. ESTADO GLOBAL (world, camera, dungeon, econ e GL3 estão em src/core/state.ts)
  --------------------------------------------------------------------- */

  /* ---------------------------------------------------------------------
     3. WATER SYSTEM — lê os próprios pixels do mapa pra achar água de verdade
  --------------------------------------------------------------------- */

  /* ---------------------------------------------------------------------
     4. VEGETATION SYSTEM
  --------------------------------------------------------------------- */

  /* ---------------------------------------------------------------------
     6. ANIMAL — criação
  --------------------------------------------------------------------- */

  /* ---------------------------------------------------------------------
     7. INICIALIZAÇÃO DA POPULAÇÃO
  --------------------------------------------------------------------- */

  /* ---------------------------------------------------------------------
     11. CÂMERA (mundo -> tela), idêntica em espírito ao Atlas
  --------------------------------------------------------------------- */

  /* ---------------------------------------------------------------------
     14. UI
  --------------------------------------------------------------------- */

  (function wireHabitat() {
    document.getElementById("btn-habitat")!.onclick = () => {
      renderHabitat();
      document.getElementById("hab-modal")!.classList.add("open");
    };
    document.getElementById("hab-close")!.onclick = () =>
      document.getElementById("hab-modal")!.classList.remove("open");
  })();

  /* ---------------------------------------------------------------------
     17. CRIAÇÃO DE PERSONAGEM
  --------------------------------------------------------------------- */
}
