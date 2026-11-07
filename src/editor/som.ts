/* ==== v8.1 — Modo Editor: os sons de área (as peças "som:<tipo>" da decoração) ====
   Cada tipo de som é sintetizado na hora (sem arquivo de áudio, como o resto do som do jogo: audio/som.ts): rio, mar,
   vento, floresta com pássaros, fogo estalando, grilos (só à noite) e o burburinho da vila. Um gerador por tipo; o
   volume é o da área mais perto de quem ouve (a câmera), sumindo até a borda do raio. Sem área por perto um tempo, o
   gerador para. Volume geral: o dos efeitos (OPT.sfx). */
import { OPT } from "../core/state.ts";
import { _out, audioCtx } from "../audio/som.ts";
import { luzDoDia } from "../render/luz_do_dia.ts";
import { SONS } from "../data/editor.ts";
import type { Deco } from "./estado.ts";

/** volume: o máximo de cada tipo (× OPT.sfx); parar: segundos em silêncio até desligar o gerador. */
const SOM_AREA = {
  volume: { rio: 0.32, mar: 0.4, vento: 0.22, floresta: 0.16, fogueira: 0.28, grilos: 0.1, vila: 0.2 } as Record<
    string,
    number
  >,
  parar: 6,
};

interface Gerador {
  saida: GainNode;
  nos: AudioNode[];
  fontes: AudioScheduledSourceNode[];
  timer: ReturnType<typeof setInterval> | null;
  silencio: number;
}
const GER = new Map<string, Gerador>();
const RUIDO: { buf: AudioBuffer | null } = { buf: null };

/** Ruído marrom (grave, como água), 4 s em laço. */
function ruido(ac: AudioContext) {
  if (RUIDO.buf) return RUIDO.buf;
  const n = ac.sampleRate * 4,
    b = ac.createBuffer(1, n, ac.sampleRate),
    d = b.getChannelData(0);
  let ult = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    ult = (ult + 0.02 * w) / 1.02;
    d[i] = ult * 3.5;
  }
  return (RUIDO.buf = b);
}
function fonteRuido(ac: AudioContext, g: Gerador) {
  const s = ac.createBufferSource();
  s.buffer = ruido(ac);
  s.loop = true;
  s.loopStart = Math.random() * 3;
  s.start(0, Math.random() * 3);
  g.fontes.push(s);
  return s;
}
function lfo(ac: AudioContext, g: Gerador, freq: number, amp: number, alvo: AudioParam) {
  const o = ac.createOscillator(),
    k = ac.createGain();
  o.frequency.value = freq;
  k.gain.value = amp;
  o.connect(k).connect(alvo);
  o.start();
  g.fontes.push(o);
  g.nos.push(k);
}
/** Um estalo/pio curto: um oscilador com envelope (pássaro, martelo, fagulha). */
function bip(
  ac: AudioContext,
  g: Gerador,
  f0: number,
  f1: number,
  dur: number,
  vol: number,
  tipo: OscillatorType = "sine",
) {
  const o = ac.createOscillator(),
    k = ac.createGain(),
    t = ac.currentTime;
  o.type = tipo;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  k.gain.setValueAtTime(0, t);
  k.gain.linearRampToValueAtTime(vol, t + Math.min(0.02, dur / 4));
  k.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(k).connect(g.saida);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function criar(tipo: string): Gerador | null {
  const ac = audioCtx(),
    saida = ac.createGain();
  saida.gain.value = 0;
  saida.connect(_out());
  const g: Gerador = { saida, nos: [], fontes: [], timer: null, silencio: 0 };
  const filtro = (t: BiquadFilterType, f: number, q = 0.7) => {
    const b = ac.createBiquadFilter();
    b.type = t;
    b.frequency.value = f;
    b.Q.value = q;
    g.nos.push(b);
    return b;
  };
  const corpo = ac.createGain();
  corpo.gain.value = 1;
  corpo.connect(saida);
  g.nos.push(corpo);
  if (tipo === "rio") {
    const f = filtro("bandpass", 650, 0.5);
    fonteRuido(ac, g).connect(f).connect(corpo);
    const f2 = filtro("highpass", 1800, 0.4),
      k2 = ac.createGain();
    k2.gain.value = 0.25;
    g.nos.push(k2);
    fonteRuido(ac, g).connect(f2).connect(k2).connect(corpo);
    lfo(ac, g, 0.23, 0.18, corpo.gain);
  } else if (tipo === "mar") {
    fonteRuido(ac, g)
      .connect(filtro("lowpass", 520, 0.4))
      .connect(corpo);
    corpo.gain.value = 0.6;
    lfo(ac, g, 0.13, 0.45, corpo.gain);
  } else if (tipo === "vento") {
    const f = filtro("bandpass", 500, 1.2);
    fonteRuido(ac, g).connect(f).connect(corpo);
    lfo(ac, g, 0.07, 280, f.frequency);
    lfo(ac, g, 0.11, 0.35, corpo.gain);
  } else if (tipo === "floresta") {
    const k = ac.createGain();
    k.gain.value = 0.25;
    g.nos.push(k);
    fonteRuido(ac, g)
      .connect(filtro("bandpass", 900, 0.3))
      .connect(k)
      .connect(corpo);
    g.timer = setInterval(() => {
      if (Math.random() < 0.45) {
        const f = 2200 + Math.random() * 2200,
          n = 1 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++)
          setTimeout(
            () =>
              bip(
                ac,
                g,
                f * (1 + Math.random() * 0.1),
                f * (0.75 + Math.random() * 0.5),
                0.09 + Math.random() * 0.08,
                0.35,
              ),
            i * 130,
          );
      }
    }, 700);
  } else if (tipo === "fogueira") {
    fonteRuido(ac, g)
      .connect(filtro("lowpass", 260, 0.5))
      .connect(corpo);
    g.timer = setInterval(() => {
      const n = Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++)
        setTimeout(
          () => bip(ac, g, 1400 + Math.random() * 2600, 300, 0.02 + Math.random() * 0.03, 0.5, "square"),
          Math.random() * 200,
        );
    }, 180);
  } else if (tipo === "grilos") {
    const o = ac.createOscillator(),
      am = ac.createGain();
    o.frequency.value = 4400;
    am.gain.value = 0;
    o.connect(am).connect(corpo);
    o.start();
    g.fontes.push(o);
    g.nos.push(am);
    lfo(ac, g, 28, 0.5, am.gain);
    g.timer = setInterval(() => {
      const t = ac.currentTime;
      corpo.gain.cancelScheduledValues(t);
      corpo.gain.setValueAtTime(0, t);
      corpo.gain.linearRampToValueAtTime(Math.random() < 0.7 ? 1 : 0, t + 0.05);
    }, 420);
  } else if (tipo === "vila") {
    const f = filtro("bandpass", 700, 0.6);
    fonteRuido(ac, g).connect(f).connect(corpo);
    lfo(ac, g, 0.9, 260, f.frequency);
    lfo(ac, g, 0.31, 0.3, corpo.gain);
    g.timer = setInterval(() => {
      if (Math.random() < 0.3) bip(ac, g, 1800, 1700, 0.25, 0.25, "triangle");
    }, 900);
  } else return null;
  return g;
}
function desligar(tipo: string) {
  const g = GER.get(tipo);
  if (!g) return;
  if (g.timer) clearInterval(g.timer);
  for (const f of g.fontes)
    try {
      f.stop();
    } catch (_) {}
  for (const n of [...g.nos, g.saida]) n.disconnect();
  GER.delete(tipo);
}

/** A cada quadro do campo: o volume de cada tipo pela área mais perto de (x, z) (px absolutos). `pecas` = as da cena. */
export function somAmbiente(pecas: Deco[], x: number, z: number, dt: number) {
  if (!OPT.sfx) {
    for (const t of [...GER.keys()]) desligar(t);
    return;
  }
  const alvo: Record<string, number> = {},
    [escuro] = luzDoDia();
  for (const p of pecas) {
    if (!p.m.startsWith("som:")) continue;
    const tipo = p.m.slice(4),
      raio = p.raio ?? SONS[tipo]?.raio ?? 200,
      d = Math.hypot(p.x - x, p.z - z);
    if (d >= raio) continue;
    let k = 1 - d / raio;
    k = k * k * (3 - 2 * k) * (p.forca ?? 1);
    if (tipo === "grilos") k *= Math.min(1, escuro * 1.6);
    alvo[tipo] = Math.max(alvo[tipo] || 0, k);
  }
  for (const [tipo, k] of Object.entries(alvo)) {
    if (k <= 0.001 || GER.has(tipo)) continue;
    try {
      const g = criar(tipo);
      if (g) GER.set(tipo, g);
    } catch (_) {}
  }
  for (const [tipo, g] of GER) {
    const k = alvo[tipo] || 0;
    try {
      g.saida.gain.setTargetAtTime(k * (SOM_AREA.volume[tipo] ?? 0.2), audioCtx().currentTime, 0.25);
    } catch (_) {}
    g.silencio = k > 0.001 ? 0 : g.silencio + dt;
    if (g.silencio > SOM_AREA.parar) desligar(tipo);
  }
}
/** Sai do campo: silêncio. */
export function pararSomAmbiente() {
  for (const t of [...GER.keys()]) desligar(t);
}
