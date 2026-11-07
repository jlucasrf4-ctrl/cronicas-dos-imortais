/* ==== Fase 4 — áudio: efeitos sintetizados e música ambiente gerada (base/18) ==== */
import { SOM, OPT } from "../core/state.ts";

/* ---------- áudio: volume geral dos efeitos + música ambiente gerada ---------- */
export function _out() {
  if (!SOM._mg) {
    SOM._mg = SOM._ac!.createGain();
    SOM._mg.gain.value = OPT.sfx;
    SOM._mg.connect(SOM._ac!.destination);
  }
  return SOM._mg;
}
export function audioCtx() {
  SOM._ac = SOM._ac || new (window.AudioContext || window.webkitAudioContext)();
  if (SOM._ac.state === "suspended") SOM._ac.resume();
  return SOM._ac;
}

interface EstadoMUS {
  g: GainNode | null;
  nodes: AudioScheduledSourceNode[];
  timer: ReturnType<typeof setTimeout> | null;
  mode: string | null;
  media: HTMLAudioElement | null;
  silenciosa: boolean;
  // acrescentados depois
  wind?: AudioBufferSourceNode;
}
export const MUS: EstadoMUS = { g: null, nodes: [], timer: null, mode: null, media: null, silenciosa: false };
export function musicStart(mode: string, silenciosa = false) {
  // pad suave com acordes lentos + vento
  try {
    const ac = audioCtx();
    if (MUS.mode === mode) {
      if (MUS.silenciosa && !silenciosa && MUS.g) {
        MUS.silenciosa = false;
        if (MUS.media) {
          MUS.media.currentTime = 0;
          void MUS.media.play().catch(() => {});
        }
        const t = ac.currentTime;
        MUS.g.gain.cancelScheduledValues(t);
        MUS.g.gain.setValueAtTime(0, t);
        MUS.g.gain.linearRampToValueAtTime(OPT.music * 0.22, t + 2.5);
      }
      return;
    }
    musicStop(0.8);
    MUS.mode = mode;
    MUS.silenciosa = silenciosa;
    const g = ac.createGain();
    g.gain.value = silenciosa ? 0 : OPT.music * 0.22;
    g.connect(ac.destination);
    if (!silenciosa) g.gain.linearRampToValueAtTime(OPT.music * 0.22, ac.currentTime + 2.5);
    MUS.g = g;
    if (mode === "calm" || mode === "dark") {
      const media = new Audio("/src/assets/audio/minor-key-pulse.m4a");
      media.loop = true;
      media.preload = "auto";
      ac.createMediaElementSource(media).connect(g);
      MUS.media = media;
      void media.play().catch(() => {});
      return;
    }
    const CH =
      mode === "dark"
        ? [
            [110, 130.8, 164.8],
            [98, 116.5, 146.8],
            [87.3, 110, 130.8],
            [92.5, 110, 138.6],
          ]
        : [
            [110, 164.8, 220, 261.6],
            [87.3, 130.8, 174.6, 220],
            [130.8, 196, 261.6, 329.6],
            [98, 146.8, 196, 246.9],
          ];
    let ci = 0;
    const play = () => {
      if (MUS.g !== g) return;
      const t = ac.currentTime,
        ch = CH[ci++ % CH.length];
      for (const f of ch)
        for (const det of [-4, 4]) {
          const o = ac.createOscillator(),
            og = ac.createGain(),
            fl = ac.createBiquadFilter();
          o.type = mode === "dark" ? "sawtooth" : "triangle";
          o.frequency.value = f;
          o.detune.value = det;
          fl.type = "lowpass";
          fl.frequency.value = mode === "dark" ? 500 : 1400;
          og.gain.setValueAtTime(0, t);
          og.gain.linearRampToValueAtTime(0.09 / ch.length, t + 2.2);
          og.gain.linearRampToValueAtTime(0, t + 7.5);
          o.connect(fl);
          fl.connect(og);
          og.connect(g);
          o.start(t);
          o.stop(t + 7.6);
          MUS.nodes.push(o);
        }
      if (mode !== "dark" && Math.random() < 0.7) {
        const o = ac.createOscillator(),
          og = ac.createGain(),
          t2 = t + 1 + Math.random() * 3;
        o.type = "sine";
        o.frequency.value = ch[ch.length - 1] * 2 * (Math.random() < 0.5 ? 1 : 1.5);
        og.gain.setValueAtTime(0, t2);
        og.gain.linearRampToValueAtTime(0.035, t2 + 0.05);
        og.gain.exponentialRampToValueAtTime(0.0005, t2 + 3);
        o.connect(og);
        og.connect(g);
        o.start(t2);
        o.stop(t2 + 3.1);
      }
      MUS.nodes = MUS.nodes.filter((n) => {
        try {
          return n.context.currentTime < t + 8;
        } catch (e) {
          return false;
        }
      });
      MUS.timer = setTimeout(play, 6000);
    };
    // vento (ruído filtrado bem baixo)
    const n = Math.floor(ac.sampleRate * 4),
      buf = ac.createBuffer(1, n, ac.sampleRate),
      dd = buf.getChannelData(0);
    for (let i = 0; i < n; i++) dd[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource(),
      wf = ac.createBiquadFilter(),
      wg = ac.createGain();
    src.buffer = buf;
    src.loop = true;
    wf.type = "bandpass";
    wf.frequency.value = 420;
    wf.Q.value = 0.6;
    wg.gain.value = mode === "dark" ? 0.05 : 0.025;
    src.connect(wf);
    wf.connect(wg);
    wg.connect(g);
    src.start();
    MUS.nodes.push(src);
    MUS.wind = src;
    play();
  } catch (e) {}
}
export function musicStop(fade: number) {
  try {
    clearTimeout(MUS.timer!);
    const g = MUS.g;
    MUS.mode = null;
    MUS.silenciosa = false;
    MUS.g = null;
    if (!g) return;
    const t = SOM._ac!.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + (fade || 1));
    const ns = MUS.nodes;
    MUS.nodes = [];
    const media = MUS.media;
    MUS.media = null;
    if (media)
      setTimeout(
        () => {
          media.pause();
          media.currentTime = 0;
        },
        Math.max(0, fade * 1000),
      );
    setTimeout(
      () => {
        for (const n of ns)
          try {
            n.stop();
          } catch (e) {}
        try {
          g.disconnect();
        } catch (e) {}
      },
      (fade || 1) * 1000 + 100,
    );
  } catch (e) {}
}
export function cineSfx(kind: string) {
  // sons da cinemática
  try {
    const ac = audioCtx(),
      t = ac.currentTime,
      out = _out();
    const tone = (type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay?: number) => {
      const o = ac.createOscillator(),
        g = ac.createGain(),
        t0 = t + (delay || 0);
      o.type = type;
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.08, dur * 0.2));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(out);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    };
    const noise = (dur: number, f0: number, f1: number, vol: number, delay?: number, type?: BiquadFilterType) => {
      const n = Math.floor(ac.sampleRate * dur),
        b = ac.createBuffer(1, n, ac.sampleRate),
        d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 1.5);
      const s = ac.createBufferSource(),
        f = ac.createBiquadFilter(),
        g = ac.createGain(),
        t0 = t + (delay || 0);
      f.type = type || "lowpass";
      f.frequency.setValueAtTime(f0, t0);
      f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      g.gain.value = vol;
      s.buffer = b;
      s.connect(f);
      f.connect(g);
      g.connect(out);
      s.start(t0);
    };
    if (kind === "hop") noise(0.12, 900, 300, 0.12);
    else if (kind === "boom") {
      tone("sine", 70, 38, 1.4, 0.5);
      noise(1.2, 1200, 80, 0.35);
    } else if (kind === "rune") {
      tone("sine", 220, 440, 2.6, 0.12);
      tone("sine", 330, 660, 2.6, 0.08, 0.2);
      tone("triangle", 660, 1320, 2.2, 0.04, 0.5);
    } else if (kind === "rise") {
      tone("sawtooth", 80, 320, 3.2, 0.06);
      tone("sine", 160, 640, 3.2, 0.08);
      noise(3.2, 300, 3000, 0.08, 0, "bandpass");
    } else if (kind === "flash") {
      noise(1.6, 6000, 200, 0.45);
      tone("sine", 900, 120, 1.2, 0.2);
    } else if (kind === "suck") {
      noise(1.5, 2400, 120, 0.22, 0, "bandpass");
      tone("sine", 520, 70, 1.35, 0.18);
    } else if (kind === "roar") {
      tone("sawtooth", 160, 55, 1.8, 0.32);
      tone("square", 110, 45, 1.6, 0.12, 0.05);
      noise(1.9, 1600, 180, 0.4);
    } else if (kind === "uivo") {
      // v8.1 — o lobo que segue a heroína no caminho até o acampamento (intro/caminhada.ts)
      tone("sine", 330, 560, 0.7, 0.16);
      tone("sine", 560, 300, 2.1, 0.14, 0.65);
      tone("triangle", 660, 600, 1.6, 0.03, 0.8);
    } else if (kind === "title") {
      tone("sine", 196, 196, 3.5, 0.12);
      tone("sine", 293.7, 293.7, 3.5, 0.08, 0.15);
      tone("sine", 392, 392, 3.5, 0.06, 0.3);
    }
  } catch (e) {}
}
