/* ==== Fase 5 — campos que o jogo pendura nos elementos da página e no window ====
   O código guarda pequenos estados direto no elemento (temporizador do aviso, última assinatura desenhada, item da
   peça do inventário…). Aqui eles ficam declarados, com o que guardam. Só tipos: nada disto existe em tempo de
   execução além do que o próprio jogo atribui. */
import type { GradeTela, Item } from "./core/tipos.ts";

declare global {
  interface HTMLElement {
    _t?: ReturnType<typeof setTimeout>; // some depois de um tempo (avisos, faixas)
    _t0?: number; // quando abriu (ignora o clique que abriu a janela)
    _h?: string; // último HTML escrito (só reescreve se mudou)
    _sig?: string; // assinatura do último desenho (só redesenha se mudou)
    _sig2?: string;
    _onClose?: (() => void) | null; // chamado ao fechar o painel
    _typing?: boolean; // o diálogo ainda está digitando o texto
    _sm?: string | boolean | null; // modo mostrado no botão: "bow", ou spearMode() (true/false)
    _bw?: number | boolean; // o botão mostra o arco
    _sk?: boolean; // é dia (ícone do céu)
    _gr?: GradeTela; // a grade de inventário desenhada neste elemento
    _it?: Item; // o item desta peça do inventário
    _b?: number; // listeners já instalados (marcas: 1)
    _fast?: number;
    _fg2?: number;
    _ic?: number;
    _icoP?: number;
    _sel?: number;
    _tbl?: number;
    _home?: { p: ParentNode; n: ChildNode | null };
    _v3?: number; // grade já ligada aos eventos (renderInvGrid)
    _last?: { it: Item; t: number } | null; // último item tocado na grade (toque duplo) // lugar original do botão na barra (tblBase), para voltar
  }
  interface Element {
    _it?: Item;
  }
  interface Window {
    webkitAudioContext?: typeof AudioContext; // Safari antigo
    __t?: Record<string, unknown>; // gancho de teste (só no build de teste: src/dev/gancho.ts)
  }
}
export {};
