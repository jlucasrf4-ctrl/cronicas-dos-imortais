import { describe, expect, it } from "vitest";
import { angDiff, clamp, esc, fmtClock, hexToRgba } from "../../src/core/util.ts";

// Fase 4/6: utilitários puros, importados direto do módulo.
describe("core/util", () => {
  it("clamp", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("angDiff: menor diferença absoluta, dando a volta no círculo", () => {
    expect(angDiff(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2);
    expect(angDiff(0.1, 2 * Math.PI - 0.1)).toBeCloseTo(0.2);
    expect(angDiff(-Math.PI, Math.PI)).toBeCloseTo(0);
  });

  it("esc: escapa & < > e aspas", () => {
    expect(esc(`<b a="1">&</b>`)).toBe("&lt;b a=&quot;1&quot;&gt;&amp;&lt;/b&gt;");
    expect(esc(42)).toBe("42");
  });

  it("hexToRgba (e o cache devolve o mesmo texto)", () => {
    expect(hexToRgba("#ff8000", 0.5)).toBe("rgba(255,128,0,0.5)");
    expect(hexToRgba("#ff8000", 0.5)).toBe("rgba(255,128,0,0.5)");
    expect(hexToRgba("00ff00", 1)).toBe("rgba(0,255,0,1)");
  });

  it("fmtClock: minutos do dia -> HH:MM (dá a volta em 24 h)", () => {
    expect(fmtClock(0)).toBe("00:00");
    expect(fmtClock(61.9)).toBe("01:01");
    expect(fmtClock(24 * 60 + 5)).toBe("00:05");
  });
});
