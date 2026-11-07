/* ==== Fase 4 — localStorage com JSON e sem exceção (lsGet/lsSet/lsDel). Saiu de base/18 (v3.16) ==== */

export function lsGet(k: string) {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : null;
  } catch (e) {
    return null;
  }
}
export function lsSet(k: string, v: unknown) {
  try {
    localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
    return true;
  } catch (e) {
    return false;
  }
}
export function lsDel(k: string) {
  try {
    localStorage.removeItem(k);
  } catch (e) {}
}
