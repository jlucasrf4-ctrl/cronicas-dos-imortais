/* ==== Fase 4 — painéis de espaços de save e opções (base/18) ==== */
import { SAVE_SLOTS, SKEY, saveTo, MKEY, slotMeta, loadFrom, exportSave, importSave } from "../save/salvar.ts";
import { lsDel } from "../core/storage.ts";
import { OPT, OPT_DEF } from "../core/state.ts";
import { sfx } from "../field/chao.ts";
import { optSave } from "./opcoes.ts";

/* ---------- painéis: espaços de save e opções (servem para o título e para o menu do jogo) ---------- */
function fmtWhen(ts: string | number | Date) {
  const d = new Date(ts);
  return (
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) +
    " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
}
export function mvPanel(id: string) {
  let p = document.getElementById(id);
  if (!p) {
    p = document.createElement("div");
    p.id = id;
    p.className = "mv-panel";
    p.innerHTML = '<div class="mv-card"></div>';
    document.body.appendChild(p);
    p.addEventListener("pointerdown", (e) => {
      if (e.target === p) mvClose(p!);
    });
  }
  return p;
}
export function mvClose(p: HTMLElement) {
  p.classList.remove("open");
  if (p._onClose) {
    const f = p._onClose;
    p._onClose = null;
    f();
  }
}
export function openSlots(mode: string, onDone: (r?: string) => void) {
  // mode: "load" | "save"
  const p = mvPanel("mv-slots"),
    card = p.querySelector(".mv-card") as HTMLElement;
  const render = () => {
    card.innerHTML =
      "<h2>" +
      (mode === "save" ? "💾 Salvar jogo" : "📜 Carregar jogo") +
      '</h2><div class="mv-sub">' +
      (mode === "save"
        ? "Escolha um espaço. O automático é usado pelo próprio jogo."
        : "Escolha de onde continuar a crônica.") +
      "</div>" +
      SAVE_SLOTS.map((s) => {
        const m = slotMeta(s),
          has =
            !!m &&
            (() => {
              try {
                return !!localStorage.getItem(SKEY(s));
              } catch (e) {
                return false;
              }
            })();
        const nm = s === "auto" ? "Automático" : "Espaço " + s,
          ic = s === "auto" ? "⟳" : ["", "Ⅰ", "Ⅱ", "Ⅲ"][+s];
        const info = has
          ? "Dia " +
            m.day +
            " · " +
            m.time +
            " · " +
            (m.heroes.length ? m.heroes.join(", ") : "sem heróis") +
            " · 💰 " +
            m.gold
          : "Vazio";
        const bt =
          mode === "save"
            ? s === "auto"
              ? ""
              : '<button class="mv-b pri" data-save="' + s + '">' + (has ? "Sobrescrever" : "Salvar aqui") + "</button>"
            : '<button class="mv-b pri" data-load="' + s + '"' + (has ? "" : " disabled") + ">Carregar</button>";
        return (
          '<div class="mv-slot' +
          (has ? "" : " empty") +
          '"><div class="ic">' +
          ic +
          '</div><div class="tx"><b>' +
          nm +
          "</b><div>" +
          info +
          "</div>" +
          (has ? "<div>salvo em " + fmtWhen(m.at) + "</div>" : "") +
          '</div><div class="bt">' +
          bt +
          (has
            ? '<button class="mv-b" data-exp="' +
              s +
              '" title="Baixar como arquivo">⬇</button><button class="mv-b danger" data-del="' +
              s +
              '" title="Apagar">✕</button>'
            : "") +
          "</div></div>"
        );
      }).join("") +
      '<div class="mv-row">' +
      (mode === "load"
        ? '<button class="mv-b" data-imp="1">⬆ Importar arquivo de save</button>'
        : '<button class="mv-b" data-expnow="1">⬇ Baixar o jogo atual como arquivo</button>') +
      '<button class="mv-b" data-back="1">← Voltar</button></div>';
  };
  card.onclick = (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b || b.disabled) return;
    if (b.dataset.back) {
      mvClose(p);
      return;
    }
    if (b.dataset.save) {
      const s = b.dataset.save,
        m = slotMeta(s);
      if (m && !b.dataset.sure) {
        b.dataset.sure = "1";
        b.textContent = "Confirmar?";
        return;
      }
      if (saveTo(s)) {
        mvClose(p);
        if (onDone) onDone("saved");
      }
      return;
    }
    if (b.dataset.load) {
      if (loadFrom(b.dataset.load)) {
        p._onClose = null;
        p.classList.remove("open");
        if (onDone) onDone("loaded");
      }
      return;
    }
    if (b.dataset.del) {
      if (!b.dataset.sure) {
        b.dataset.sure = "1";
        b.textContent = "Apagar?";
        return;
      }
      lsDel(SKEY(b.dataset.del));
      lsDel(MKEY(b.dataset.del));
      render();
      return;
    }
    if (b.dataset.exp) {
      exportSave(b.dataset.exp);
      return;
    }
    if (b.dataset.expnow) {
      exportSave(null);
      return;
    }
    if (b.dataset.imp) {
      importSave(() => {
        p._onClose = null;
        p.classList.remove("open");
        if (onDone) onDone("loaded");
      });
      return;
    }
  };
  render();
  p.classList.add("open");
}
export function openOptions(onClose?: null) {
  const p = mvPanel("mv-opts"),
    card = p.querySelector(".mv-card") as HTMLElement;
  p._onClose = onClose || null;
  const sw = (k: string) => '<div class="mv-sw' + (OPT[k] ? " on" : "") + '" data-sw="' + k + '"></div>';
  const render = () => {
    card.innerHTML =
      '<h2>⚙ Opções</h2><div class="mv-sub">As escolhas ficam salvas neste navegador.</div>' +
      '<div class="mv-opt"><label><i class="ic ico-ui_som"></i> Efeitos sonoros</label><input type="range" min="0" max="1" step="0.05" value="' +
      OPT.sfx +
      '" data-rg="sfx"></div>' +
      '<div class="mv-opt"><label><i class="ic ico-ui_musica"></i> Música ambiente</label><input type="range" min="0" max="1" step="0.05" value="' +
      OPT.music +
      '" data-rg="music"></div>' +
      '<div class="mv-opt"><label>⚡ Resolução 3D automática<small>Se o jogo ficar lento, desenha a cena 3D um pouco menor (a interface continua nítida)</small></label>' +
      sw("autoRes") +
      "</div>" +
      '<div class="mv-opt"><label>🖥 Qualidade gráfica<small>Baixa ajuda em computadores mais fracos</small></label><select data-sel="gfx"><option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option></select></div>' +
      '<div class="mv-opt"><label>🗺 Mapa do mundo redesenhado<small>Desligado mostra o mapa pintado original</small></label>' +
      sw("mapNew") +
      "</div>" +
      '<div class="mv-opt"><label>🧊 Masmorra em 3D<small>Desligado usa a visão 2D clássica</small></label>' +
      sw("d3") +
      "</div>" +
      '<div class="mv-opt"><label>📳 Tremor de tela</label>' +
      sw("shake") +
      "</div>" +
      '<div class="mv-opt"><label><i class="ic ico-ui_dicas"></i> Dicas na tela</label>' +
      sw("hints") +
      "</div>" +
      '<div class="mv-opt"><label>⚔ Ataque básico automático (teste)<small>Clique no inimigo para repetir os básicos ao alcance. Desligado: um golpe por clique. Botão direito mantém o especial da arma.</small></label>' +
      sw("ataqueAutomatico") +
      "</div>" +
      '<div class="mv-opt"><label>🔤 Avisos em texto<small>Desligado: ícones e efeitos no lugar de frases na luta</small></label>' +
      sw("textos") +
      "</div>" +
      '<div class="mv-opt"><label><i class="ic ico-ui_contorno"></i> Contorno nos personagens<small>Visual de desenho na masmorra</small></label>' +
      sw("outline") +
      "</div>" +
      // v8.1: os estados da heroína perto dela (field/estados.ts); pode ligar mais de um
      '<div class="mv-opt"><label>◔ Estados no anel de fôlego<small>Combate a cada 1,6 s; fome, frio e o resto como lembrete a cada 1:30</small></label>' +
      sw("estAnel") +
      "</div>" +
      '<div class="mv-opt"><label>◉ Estados em selos<small>Até 3 em volta do anel: amarelo começando, vermelho atrapalhando</small></label>' +
      sw("estSelos") +
      "</div>" +
      '<div class="mv-opt"><label>▭ Fita de estados sob os pés<small>Clique nela para ver todos os efeitos e as necessidades</small></label>' +
      sw("estFita") +
      "</div>" +
      '<div class="mv-opt"><label>✨ Runas Naturais<small>Aparecem no mapa e na masmorra</small></label>' +
      sw("runas") +
      "</div>" +
      '<div class="mv-opt"><label><i class="ic ico-ui_toque"></i> Controles de toque<small>Joystick e botões na masmorra, abas no mapa</small></label><select data-sel="touch"><option value="auto">Automático</option><option value="on">Sempre</option><option value="off">Nunca</option></select></div>' +
      '<div class="mv-opt"><label>💾 Salvamento automático<small>A cada 3 minutos no mapa e ao voltar da masmorra</small></label>' +
      sw("autosave") +
      "</div>" +
      '<div class="mv-row"><button class="mv-b" data-def="1">Restaurar padrão</button><button class="mv-b pri" data-back="1">Pronto</button></div>';
    (card.querySelector("[data-sel=gfx]") as HTMLInputElement).value = OPT.gfx;
    (card.querySelector("[data-sel=touch]") as HTMLInputElement).value = OPT.touch || "auto";
  };
  card.oninput = (e) => {
    const r = (e.target as HTMLElement).dataset.rg;
    if (r) {
      OPT[r] = +(e.target as HTMLInputElement).value;
      optSave();
      if (r === "sfx") sfx("ping");
    }
  };
  card.onchange = (e) => {
    const s = (e.target as HTMLElement).dataset.sel;
    if (s) {
      OPT[s] = (e.target as HTMLInputElement).value;
      optSave();
    }
  };
  card.onclick = (e) => {
    const s = (e.target as HTMLElement).closest("[data-sw]") as HTMLElement;
    if (s) {
      OPT[s.dataset.sw!] = !OPT[s.dataset.sw!];
      optSave();
      render();
      return;
    }
    const b = (e.target as HTMLElement).closest("button");
    if (!b) return;
    if (b.dataset.back) mvClose(p);
    if (b.dataset.def) {
      Object.assign(OPT, OPT_DEF);
      optSave();
      render();
    }
  };
  render();
  p.classList.add("open");
}
