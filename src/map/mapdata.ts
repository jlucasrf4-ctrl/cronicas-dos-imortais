/* ==== Fase 4 — MAPDATA: o mapa vetorial (src/assets/map/mapdata.json, base/12) ==== */

/** O mapa vetorial (mapdata.json). Coordenadas em pixels do mapa; as listas planas são x, y, x, y… */
interface MapData {
  K: number; // escala do mundo em que o arquivo foi desenhado
  coast: number[][]; // contornos da costa
  ripple: number[][][]; // linhas de ondulação, por faixa
  land: string; // textura da terra (PNG em base64)
  sea: string; // textura do mar (PNG em base64)
  dens: string; // mapa de densidade da vegetação (PNG em base64)
  hills: [x: number, y: number, r: number][];
  ships: [x: number, y: number, dir: number][];
  settle: [id: string, nome: string, x: number, y: number, nivel: number | string][]; // nível de cidade, ou "t" (torre) / letra de vila
  roads: { a: string; b: string; major: boolean; p: number[] }[];
}

// o marcador precisa de `{}` logo depois do comentário (o plugin troca os dois pelo JSON); o `as` vem depois
export const MAPDATA = /* @inline-json src/assets/map/mapdata.json */ {} as MapData;
