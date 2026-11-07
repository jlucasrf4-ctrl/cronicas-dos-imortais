# Mapa Vivo — Crônicas dos Imortais (v8.1)

A browser RPG and living-world simulation in Brazilian Portuguese, set in a low-magic world.
You create heroes, send them across a living world map, and play expeditions as real-time
action in a low-poly 3D view: hunting, combat, survival, crafting, natural runes and a
tamanduá (giant anteater) mount.

The game ships as **one self-contained HTML file** (~7 MB). All code, styles and art are inside it.

## Quick start

```bash
npm ci                              # Node ≥22.18: TypeScript, Vite, Vitest, ESLint, Prettier, sharp
npm run build                       # Vite -> dist/game.html (+ dist/vtest.html with the test hook)
npm run dev                         # dev server at http://localhost:5173/, reloads when src/ changes
npm run typecheck && npm test       # tsc + Vitest unit tests (Node only, no browser)
```

Open `dist/game.html` in a browser (Chrome or Edge recommended, since the game needs WebGL2). No server is needed.

## Tech stack

| Layer | Technology |
|---|---|
| Game runtime | Vanilla **JavaScript** (ES2020+) with no framework, moving to **TypeScript ES modules** (Phase 4 of ROADMAP.md). Vite bundles `src/main.ts` and ~170 TS modules (`src/core/`, `src/map/`, `src/field/`…, `src/inicio/` for the load-time code) into one `<script type="module">` |
| Rendering | **Canvas 2D** for the world map, the 2D field view and UI effects. A hand-written **WebGL2** renderer (GLSL shaders, shadow mapping, toon shading, outlines, procedurally generated low-poly meshes) for 3D |
| UI | Plain **HTML + CSS**, with DOM-built modals and panels. Touch controls (joystick and buttons) for mobile |
| Audio | **Web Audio API** (`AudioContext`), with sounds synthesized in code |
| Persistence | **localStorage** (save slots, options, touch-button layout) |
| Assets | WebP files in `src/assets/`, embedded as **base64 data URIs** at build time (icons as `.ico-<key>` CSS classes). The world map is vector data (`src/assets/map/mapdata.json` → `MAPDATA`) |
| External deps | Only Google Fonts (Cinzel, Cinzel Decorative, Lora) |
| Build | **Vite** + vite-plugin-singlefile, with a small plugin of our own (`tools/vite-plugin-jogo.ts`) that adds the `<style>` blocks in `src/manifest.ts` order and inlines the assets. **TypeScript** for tooling and tests, **sharp** for image processing |
| Tests / tooling | **Vitest** (Node unit tests, plus a differential test against the v7.6 reference). **Playwright (Python)** with headless Chromium: ad-hoc scripts that drive the game through a `window.__t` test hook (a port to TS `@playwright/test` is planned) |

## Project layout

```
index.html                   Markup (head + body) with the markers the build fills in
src/
  main.ts                    Entry point: imports the modules, then calls the iniciar…() functions in order
  core/ data/                State, config, rng, storage, utils, main loop; all the tunable tables
  map/ sim/                  World map (vector art, camera, quadrants, water, hunting, Vila Musgo); simulation
  field/ creatures/          The expedition/dungeon: combat, weapons, damage, ground, training; boar, tamanduá
  items/ econ/ forja/        Inventory, equipment, quality, quiver; market, chest, armory; forge, carpentry
  hero/ survival/ runas/     Hero level, attributes, proficiencies; camp, cooking, survival; natural runes
  render/ ui/ intro/         WebGL renderer, meshes, sprites; windows, HUD, icons, menus; intro scene
  audio/ save/ …             Sounds, save slots, minigames, expedition prep          <- live code (TS modules)
  inicio/base/ inicio/modulos/  Load-time code (listeners, timers, table extensions, bootstrap), one
                             iniciar…() per former legacy file, called by main.ts in the old order
  manifest.ts                Order of the CSS files
  styles/NN_*.css            Style rules; icones-pintados.css = the .ico-<key> classes
  assets/icons/ map/ art/    Icons (WebP), map image, MAPDATA (JSON), sprite atlas
  dev/gancho.ts              window.__t, only in dist/vtest.html
tools/                       Node/TS: vite-plugin-jogo.ts + lib/montagem.ts (the build), check-js.ts,
                             fix-icon-holes.ts, slice-sheet.ts (sprite-sheet slicer, sharp; no Python),
                             extract.ts (one-off Phase 2 extractor, kept as a record),
                             lib/vm-jogo.ts (runs the game in Node for the differential test)
tests/unit/                  Vitest unit tests (Node, no browser): npm test
tests/browser/legacy-py/     ~190 Playwright scripts (t*.py) that use dist/vtest.html
tests/browser/tools/         perf/ (FPS, GL and CPU profiling) and sim/ (bot playtest), Python Playwright
                             on dist/vtest.html
dist/                        Build output (git-ignored)
reference/                   Frozen v7.6 build used as the comparison baseline (do not edit)
docs/smoke-checklist.md      Manual play-test checklist run after each roadmap step
docs/roadmap-historico.md    Full history of the overhaul (Phases 0–8.1)
assets/                      Source art that was embedded into the icons (art3/, tam_img/)
_claude/                     Claude Code's notes from the previous machine (memory/), see _claude/README.md
_backups/                    Phase backup zips and the original source zip

```

## Running the tests

`npm test` runs the Node unit tests (Vitest, no browser). The browser scripts need Python and Playwright:

```bash
pip install playwright && playwright install chromium
npm run build
python tests/browser/legacy-py/t5.py   # each script prints results and saves screenshots to the current folder
python tests/browser/tools/perf/prof.py dungeon   # CPU profile + FPS; sim/sim_v45.py runs the bot for 7 min
```

The browser scripts are exploratory scripts, not a test suite. They print values and take screenshots
instead of asserting. Many were written for a specific version, so older ones may no longer match the current game.

## Known gaps (lost when the project was exported)

- **`assets/tam_img/`** is empty, so the tamanduá icons from p35 aren't included. The game falls back to emoji.
- **`assets/source_sheets/`** (the original sprite sheets the old Python slicers cut) is missing. New sheets
  go through `npm run tools:slice-sheet -- <plano.json>` (see the header of `tools/slice-sheet.ts`).
