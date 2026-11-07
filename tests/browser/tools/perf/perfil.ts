/* Perfil de CPU (amostrador do DevTools) por 5 s: as funções com mais tempo próprio.
   Uso: node tests/browser/tools/perf/perfil.ts [campo|campo-aberto|mapa|mapa-rapido] [--ref]
   Substitui os antigos prof.py e tprof.py. */
import { abrirJogo, args, cenario } from "../abrir.ts";

interface No {
  id: number;
  callFrame: { functionName: string; lineNumber: number };
}

const qual = (args[0] ?? "campo") as "campo" | "campo-aberto" | "mapa" | "mapa-rapido";
const s = await abrirJogo();
await cenario(s, qual);
const cdp = await s.page.context().newCDPSession(s.page);
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
await cdp.send("Profiler.start");
const fps = await s.js<number>(
  "new Promise(r=>{let n=0;const t0=performance.now();function f(){n++; if(performance.now()-t0<5000) requestAnimationFrame(f); else r(n/5)} requestAnimationFrame(f)})",
);
const { profile } = await cdp.send("Profiler.stop");
const nos = new Map<number, No>(profile.nodes.map((n: No) => [n.id, n]));
const proprio = new Map<string, number>();
const deltas = profile.timeDeltas ?? [];
(profile.samples ?? []).forEach((id: number, i: number) => {
  const cf = nos.get(id)!.callFrame;
  const k = `${cf.functionName || "(anônima)"}:${cf.lineNumber}`;
  proprio.set(k, (proprio.get(k) ?? 0) + (deltas[i] ?? 0));
});
const total = [...proprio.values()].reduce((a, b) => a + b, 0);
console.log(
  qual,
  "fps",
  fps,
  "heap MB",
  await s.js("performance.memory ? +(performance.memory.usedJSHeapSize/1e6).toFixed(1) : 0"),
);
for (const [k, v] of [...proprio].sort((a, b) => b[1] - a[1]).slice(0, 28))
  console.log(((v / total) * 100).toFixed(1).padStart(5) + "%  " + k);
console.log("nós no DOM", await s.js("document.getElementsByTagName('*').length"));
await s.browser.close();
