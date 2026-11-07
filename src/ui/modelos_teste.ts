/* ==== v8.1 — prévia dos personagens e criaturas na sala de teste, com animação e câmera ==== */
import { modelosTeste, clipsModeloTeste } from "../render/gl/vestidos.ts";
import { RETRATO_PAINEL } from "../render/retrato.ts";
import { opcoesAparencia, cabeNoCorpo } from "../render/gl/aparencias.ts";

let painel: HTMLDivElement | null = null;
export function abrirModelosTeste() {
  if (painel?.isConnected) {
    painel.hidden = false;
    return;
  }
  const el = document.createElement("div");
  el.id = "modelos-teste";
  el.innerHTML = `<div class="mt-topo"><b>Modelos e animações</b><button data-mt="fechar" aria-label="Fechar modelos">✕</button></div>
    <label>Personagem<select id="mt-modelo"></select></label>
    <label>Cabeça<select id="mt-cabeca"></select></label>
    <label>Movimento<select id="mt-clip"></select></label>
    <canvas width="520" height="620" title="Arraste para girar"></canvas>
    <div class="mt-controles"><button data-mt="pausa">Pausar</button><button data-mt="reiniciar">Recomeçar</button><button data-mt="frente">De frente</button></div>
    <label>Aproximação<input id="mt-zoom" type="range" min="0.45" max="2.5" step="0.05" value="1"></label>
    <p id="mt-info"></p><small>Arraste o modelo para girar. Apenas o selecionado é animado.</small>`;
  document.body.appendChild(el);
  painel = el;
  el.addEventListener("pointerdown", (e) => e.stopPropagation());
  el.addEventListener("keydown", (e) => e.stopPropagation());
  const modelo = el.querySelector<HTMLSelectElement>("#mt-modelo")!,
    clip = el.querySelector<HTMLSelectElement>("#mt-clip")!,
    cabeca = el.querySelector<HTMLSelectElement>("#mt-cabeca")!,
    cv = el.querySelector<HTMLCanvasElement>("canvas")!,
    P = RETRATO_PAINEL;
  for (const m of modelosTeste()) modelo.add(new Option(m.rotulo, m.nome));
  const rotulos: Record<string, string> = {
    parada: "Parado",
    andar: "Andar",
    correr: "Correr",
    ataque: "Atacar",
    receber_dano: "Receber dano",
    morrer: "Cair",
    voar: "Bater asas",
  };
  const escolherCabeca = () => {
    P.visual = /^corpo_/.test(modelo.value) ? { corpo: modelo.value, cabeca: cabeca.value || "propria" } : undefined;
  };
  const atualizar = () => {
    P.cv = cv;
    P.modelo = modelo.value;
    P.tempo = 0;
    P.t = 0;
    P.auto = false;
    P.yaw = 0;
    P.reproduzir = true;
    P.zoom = /quimera|grifo|hidra/.test(modelo.value) ? 0.65 : 1;
    el.querySelector<HTMLInputElement>("#mt-zoom")!.value = String(P.zoom);
    clip.replaceChildren();
    for (const c of clipsModeloTeste(modelo.value)) clip.add(new Option(rotulos[c] ?? c.replaceAll("_", " "), c));
    clip.value = "parada";
    P.clip = clip.value;
    cabeca.replaceChildren();
    const opcoes = opcoesAparencia(),
      corpo = opcoes.corpos.find((c) => c.nome === modelo.value);
    for (const c of opcoes.cabecas.filter((c) => (!corpo ? c.nome === "propria" : cabeNoCorpo(corpo, c))))
      cabeca.add(new Option(c.rotulo, c.nome));
    cabeca.disabled = !corpo;
    escolherCabeca();
    const m = modelosTeste().find((m) => m.nome === modelo.value);
    const tris = m?.anim ? atob(m.anim.malha.i).length / 6 : 0;
    el.querySelector("#mt-info")!.textContent =
      `${tris.toLocaleString("pt-BR")} triângulos na malha-base · ${clip.options.length} movimentos`;
    el.querySelector<HTMLButtonElement>('[data-mt="pausa"]')!.textContent = "Pausar";
  };
  modelo.onchange = atualizar;
  cabeca.onchange = escolherCabeca;
  clip.onchange = () => {
    P.clip = clip.value;
    P.tempo = 0;
  };
  el.querySelector<HTMLInputElement>("#mt-zoom")!.oninput = (e) => {
    P.zoom = Number((e.target as HTMLInputElement).value);
  };
  let arrasto: { x: number; yaw: number } | null = null;
  cv.onpointerdown = (e) => {
    cv.setPointerCapture(e.pointerId);
    arrasto = { x: e.clientX, yaw: P.yaw };
  };
  cv.onpointermove = (e) => {
    if (arrasto) P.yaw = arrasto.yaw + (e.clientX - arrasto.x) * 0.012;
  };
  cv.onpointerup = cv.onpointercancel = () => {
    arrasto = null;
  };
  el.onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-mt]");
    if (!b) return;
    if (b.dataset.mt === "fechar") {
      P.cv = null;
      P.modelo = "";
      el.remove();
      painel = null;
    } else if (b.dataset.mt === "pausa") {
      P.reproduzir = !P.reproduzir;
      b.textContent = P.reproduzir ? "Pausar" : "Continuar";
    } else if (b.dataset.mt === "reiniciar") P.tempo = 0;
    else if (b.dataset.mt === "frente") P.yaw = 0;
  };
  atualizar();
}
