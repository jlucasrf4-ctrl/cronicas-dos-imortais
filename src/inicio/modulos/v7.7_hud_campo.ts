/* ==== v7.7 — HUD do campo compacta (documento mestre 3.2; CSS 37_v7.7_hud_campo.css): uma linha só; a barra de
   fôlego (.dh-stbg) vai para baixo da barra de vida, dentro de #dungeon-hp-wrap; a passagem do tempo (#dh-hora) ao
   lado da fase, só no acampamento (preenchido por tempoAcampamento, field/chao.ts) ==== */

export function iniciarHudCampo() {
  const vida = document.getElementById("dungeon-hp-wrap"),
    folego = document.querySelector<HTMLElement>("#dungeon-hud > .dh-stbg");
  if (vida && folego) vida.appendChild(folego);
  const fase = document.getElementById("dungeon-wave-label");
  if (fase && !document.getElementById("dh-hora")) {
    const hora = document.createElement("span");
    hora.id = "dh-hora";
    fase.after(hora);
  }
}
