# Documento Mestre (HUD, combate, inventário, expedição, mapa, polimento): andamento

The full text of the document the maintainer sent on 2026-10-16 is in
[documento-mestre-original.md](documento-mestre-original.md). This is the progress file: one block at a time, in the
document's order of work (critical fixes → approved behaviours → integration → visuals). Tick the boxes here.

Legend: `[x]` done and tested · `[~]` partial · `[ ]` to do · **P** = needs a parameter or decision from the maintainer.

## Block 1: combat, focus, targets and movement (2026-10-16)

**Maintainer's correction (2026-10-16, replaces the first version):** the priority target is never set by hand; the
focus is what the player controls, with the left click. Alt is reserved for later (several targets at once, choosing
which one is the focus; switching the focus between targets unlocked by skill level).

- [x] Priority target (`dungeon.target`, orange dashed ring, `#focus-hud` panel with the creature's stamina) is
      **automatic only**: the last creature you hurt (`hurtMonster`, direct hits, not bleed) or the last one that
      attacked you (`hurtPlayer`), whichever happened last. Removed: Tab cycling the target, a quick right tap marking
      it, the bow's left click marking it (`markTarget`, `cycleTarget` deleted).
- [x] Focus (`dungeon.foco`, translucent white ring with 4 ticks) = **left click on a creature** (`marcarFoco`). A
      second click on the same creature does **not** remove it (with a melee weapon the same click is the swing, so the
      focus must not flicker). Esc removes it. With no live priority target, marking the focus also sets the target.
      Same creature = both rings, label "ALVO · FOCO".
- [x] No aim lock: the aim follows the mouse; the focus doesn't steer it (the first version did; the maintainer
      didn't like it).
- [x] With a melee weapon, the left click on a creature marks the focus and swings; with the bow it only marks (the
      shot is the right button). Birds: a focused bird counts as marked (sure hit), as the old marked target did.
- [x] Lasso: a creature can be bound if it is the priority target **or** the focus (was: the marked target).
- [x] Rastreador node: after a kill, the nearest creature becomes the **focus** (was: the target).
- [x] Camera: 20% farther by default (`D3.ZM` 1.4 → 1.4 / 1.2). The mouse wheel zooms in back to the old distance
      and out to the new default (`CZ.jog`, `ZOOM_JOG`); only at the farthest does scrolling out keep accumulating to
      leave for the map, as before. **To be tested by the maintainer.**
- [ ] Performance ("the game feels a bit heavy"): not investigated yet. **P** where it feels heaviest (map, field
      with many creatures, always?).- [~] 2.4 Tracking panel (`src/field/rastreio.ts`): only with the **Rastreador** node (World tree); 4 slots, 5 when the
      node is rank 2 (the heroine's genetics favours it). Nearby creatures enter on their own; Ctrl + click on a creature
      adds/removes it by hand; ✕ removes. When full, the current ones stay and a manual add is refused with a message.
      Leaving the radius or dying = removed. Orange marker over each tracked creature. Doesn't touch target/focus.
  - [x] Detection radius: `RASTREIO.raio` = 6 tiles (maintainer, 2026-10-18; it was a provisional 9).
  - [x] "Evolution of the skill" = node rank 2 (genetics), confirmed by the maintainer 2026-10-18.
  - [-] Revelação (temporary area detection pulse): left out for now (maintainer, 2026-10-18). If it comes back it
    needs a key, a tree node, radius, duration and cooldown.
- [x] 2.5 The internal stamina can reach 0 (`FOL_HEROI.min` 25 → 0). The rope tug-of-war keeps its own floor
      (`FOL_HEROI.minLaco` = 25), to keep the rope as it was tuned.
- [x] 2.5 Stamina hitting 0 for any reason locks running until it is back to 25 (it was only when running).
- [x] 2.5 Footwork (ginga) costs 20 (20% of the bar of 100; it was 10) and needs 20 to go off.
- [x] 2.5 Footwork also costs 25 of the internal stamina, like the bow roll (`GINGA.interno`; maintainer, 2026-10-18),
      and is refused below 25. The name shown to the player is now "footwork" (identifiers stay `ginga`).
- [x] 2.5 Sliding when standing up from a crouch (collect) into a run: the crouch overlay now fades in ~0.1 s as soon as
      she moves (it took 0.25 s with the legs still crouched).
- [x] 2.5 Moonwalk: walking backwards (facing the target, moving away) plays the walk cycle in reverse; running, she
      faces where she runs. The bow pack only has the *aiming* backwards walk (`arco_tras`, arms up), still used when
      aiming; it isn't right for a relaxed walk, so it isn't used there.
- [x] 2.6 Proficiencies were already separate per weapon (espada, machado, lança, clava, arco, plus faca); nothing changed.
- [ ] "A click creates/duplicates an animal": not reproduced. The test clicks on the ground and on creatures and the
      count doesn't change. **P** need the exact steps (map or field? which tool/weapon?).
- [x] Balance (maintainer, 2026-10-18: "move it to a skill"): the marked-creature bonus (`markMult`, `MARK_BONUS`) on
  the current target now needs the **Rastreador** node (the node that already marks; the mark synergies need it too).
  Without it there is no bonus on the target. Node description updated. Stuck-weapon buttons stay as they are
  (left hold = push, right = rip).

Browser check: `tests/browser/e2e/foco.spec.ts`. `folego.spec.ts` was updated for the new floor (4 rolls instead of 3).

### Combat corrections (maintainer, 2026-10-16)

- [x] Green (outer) stamina regenerates faster for each full quarter of the internal stamina
      (`FOL_HEROI.voltaQuarto` = 0.5 / 1 / 1.5 / 2 / 2.5 × for 0–4 quarters): stopping briefly already recovers, so the
      player controls the stamina by running and stopping. Replaces the old "half speed at the minimum".
- [x] The bow dash costs only the internal stamina (25%); the green running bar no longer pays for it (it is still capped
      by the internal one, which is the internal stamina's rule).
- [x] Downed creatures get up 50% sooner: `DANO.FOLEGO.koT` 12 → 8 s, `koBoss` 6 → 4 s.
- [x] Finisher: the heroine crouches (the item-collect pose) and the camera zooms in during the blow
      (`FINAL.zoom` = 1.28, i.e. 1.12 + 14% as asked).
- [x] Downed wolves and boars lie on their side (they stayed standing); the roll side follows where they face, so the
      legs face the camera.
- [x] Lobo Alfa: takes 25% less damage (`ALFA.dano` = 0.75, **proposed value**); downed, the finisher doesn't kill it:
      it takes exactly 30% of max health (`ALFA.finalizador`, never lethal) and gets up.
- [x] Kill texts no longer pile up: a new toast moves up a line until it doesn't touch another one.
- [x] Right button: only the bow waits for the hold (200 ms, to charge); parry and the spear act on press (the delay was
      getting in the way of the parry). The creatures' special attack via the internal bar was dropped by the maintainer.
### Browser suite after Block 1 (2026-10-16)

Full run: 122 passed, 31 failed; rerun of the failing specs with the corrected Block 1: 77 passed, 33 failed. None of
the failures checked so far comes from Block 1:

- `armas` t92/t96/t107: the first swing **embeds the sword** in the creature (`d.crav`, v6.2 mechanic); the test deletes
  the creatures without releasing it, so every later click is a "push" (confirmed with a diagnostic run).
- `armas` t15 expects `GL3.atk` (the old rigid-part swing), replaced by the animated combo in v7.7.
- `armas` t95 (right click = roll) and tbow (Space = bow charge): in the current code Space rolls and holding the right
  button charges; t108 holds the right button 150 ms, below the 200 ms hold (`DIREITO_HOLD_MS`).
- `dano` (5 tests): they still fail with the Block 1 target/stamina changes switched off.
- `mapa` thunt, `campo-lobos` t14: intermittent (pass when rerun).
- Inventory, forge, intro (creation timeouts), map (quadrant save, zoom), anteater: areas Block 1 doesn't touch.

These specs were ported from `legacy-py` and never validated (ROADMAP, Phase 6); fixing them is separate work.
## Block 2: HUD and visual direction

- [~] 3.2 Creation screen: the window opens with a random name (editable), so "Fazer nascer" starts available; with
      the name erased it is clearly unavailable (grey, dashed border, forbidden cursor, tooltip saying why). "Cancelar"
      and "🎲 Nome" were nearly invisible (light text on cream) and looked disabled: now readable. CSS
      `36_v7.7_botoes.css`. **Awaiting OK** (previews in `build/previas/`).
- [~] 3.1/3.2 Button states, one standard for the whole game (`36_v7.7_botoes.css`): available = `.btn` (charcoal,
      thin bronze border) · selected = `.btn.active` / `.btn.on` / `[aria-pressed=true]` (bronze fill, gold border,
      glow) · blocked = `.btn.bloq` (new: dashed grey border, 🔒, the `title` says the requirement) · unavailable =
      `:disabled` (grey, dashed, forbidden cursor). Dark panels and light cards each have their version. `.bloq` isn't
      applied to any screen yet (each screen gets it as it is redone). **Awaiting OK** (`build/previas/botoes_*.png`).
- [~] 3.2 Compact field HUD (`37_v7.7_hud_campo.css`, `v7.7_hud_campo.ts`): **floating panel at the bottom centre**
      (maintainer's correction: not at the top), like the map's bar; the scene gets the full height. Row 1: character ·
      health with the stamina bar under it · hunger/temperature/weight · arrows · backpack value · phase. Row 2: shortcuts
      as icons with the key as a small badge · test, 3D, help · Extract. Secondary details in `title` (backpack:
      stored, wood, stone, feathers; test/3D state = selected button). The mission box and the target/tracking panels now
      take the top of the scene as reference. Desktop only; the phone layout is untouched. **Awaiting OK**
      (`build/previas/hud_campo*.png`).

## Block 3: inventory and equipment

- [~] 4.1 Field backpack (part 1, `38_v7.7_mochila_campo.css`): laid out like the expedition prep, with the character on the
      left (armour column · the heroine's 3D portrait · the weapon set in use, the reserve set below), the backpack with the
      ground under it, the quiver on the right; each area has its name. No fixed text strip: the explanations moved to
      "❓ Dicas" (closed); the "backpack full" warning stays visible. The portrait reuses the prep one (`glPortrait`):
      with the field active it draws between two frames on the field's WebGL canvas and gives it back (`glPlace`).
      Every equippable item has a frame, the knife included (no quality = common). **Awaiting OK**
      (`build/previas/mochila_campo*.png`).
- [~] 4.2/4.3 Container windows (part 2, `src/ui/recipientes.ts`): in the field backpack the quiver and the anteater's
      saddlebags are their own windows (name + occupied cells in the title bar, draggable by the bar, several open at once,
      ✕ closes, buttons on the character panel open/close). The grids are the same ones (moved, not rebuilt), so drag and
      drop still uses the container under the cursor. Right click = quick transfer with a predictable destination: from
      the backpack to the open container window marked ⇄ (the last one opened or touched); from a container or the ground
      to the backpack; with no container window open, right click on the backpack still drops on the ground. No room =
      the item stays put and a message says where it didn't fit; arrows only go into the quiver. Browser check:
      `recipientes.spec.ts`. The saddlebags' size still grows with the anteater's level (Block 5 asks for a fixed size).
      **Awaiting OK** (`build/previas/aljava_janela.png`, `alforjes_janela.png`).

## Anteater model (maintainer's request, 2026-10-17)

- [x] New low poly anteater from the Tripo sheet with the packs (`arquivos de transferência/tamandua com mochilas (fantasy
      pack animal).glb`, copied from Downloads), replacing the one made of primitives. Tool `npm run tools:tamandua`
      (`tools/gerar-tamandua.ts`, plan `tools/modelos/tamandua.json`): crops the big side pose, reduces it to ~3.2k
      triangles, builds its own skeleton (root, head, tail, four legs) and the walk/run/idle/graze clips in the animals'
      format → `src/assets/models/tamandua_anim.json` (79 KB); previews in `build/modelos/tamandua/`. In the game it is
      animated like the other animals (`bichoAnimado`), grazes while foraging, coats tint the model. The model already
      has the packs, so no separate saddle is drawn (the saddle stays for a model without them).
- [x] Riding: the heroine uses the animated model (same idle/bow clips, no step), shown from the waist up: the waist is
      at the top of the cargo and the legs stay inside the anteater. **Stopgap** until the seated skeleton the maintainer
      will bring from the rigging site (remind them).
- A first version used the other sheet (`anteater 3d model selvagem com lingua e poses.glb`); dropped at the
      maintainer's request.

## Camp tutorial skip (maintainer's priority, 2026-10-17)

- [x] In the camp the hunter's dialog showed "Pular introdução", which only worked during the intro: clicking did nothing.
      Now the button says "Pular tutorial" in the camp tutorial and skips it (`ctPular` in `intro/tutorial.ts`): closes the
      dialog/fire/choice, lights the fire, tent up, hunter napping, `campTut = 3`, campaign `acampamentoFim` (Act 2). The
      tutorial's fire window has the same "Pular tutorial ⏭" (the minigame can be skipped). In other dialogs the button
      is hidden (nothing to skip). Browser check: `tutorial-pular.spec.ts`.
- [x] 4.4/4.5 Ground and drops (part 3): dropping on the ground area puts the whole item (the full stack) in the world
      next to the character, wherever it was dropped in the area (`largarNoChao`); the ground area arranges itself
      (first free spot, no overlap). Dropping on a container where it doesn't fit exactly goes to the nearest free spot,
      rotating if needed (`lugarMaisPerto`); with no room the item stays and a message says so (before it silently went
      back even with free space: the cause of `tbug2`/`tinv3`, which now pass). Arrows only go into the quiver.
      "Organizar" only applies an arrangement where everything fits, otherwise it restores every item (never discards).
      Browser check: `chao-arrastar.spec.ts`.
- `t66` (stack split) is not a duplication: the extra 2 folhama come from `runeGiveKit` (a one-time gift when the
      Natural Runes start), which the world sim delivers mid-test. Relevant to Block 6 (runes only after the real rabbit
      boss defeat).
- [x] Anteater in the field (maintainer, 2026-10-17): mount/saddlebag range measured to the body (hips to snout, 28
      units) instead of 2.1 tiles from the centre; a ground item nearby has priority over the anteater on E. Browser
      check: `tamandua.spec.ts`.

## Block 4: camp and expedition prep (started 2026-10-17)

- [x] No more automatic banking: leaving an expedition used to move the whole backpack and quiver (except arrows)
      into the camp chest (`bankLoot`); the maintainer kept going back to the field with an empty backpack. Now the items
      stay with the character; the chest only holds what the player puts in it.
- [x] 5.4 "Choosing an expedition loads the camp": entering the camp sets `CPS.pending` and launches; when the launch was
      refused (hero not idle) the flag stayed on, so the next expedition from the prep panel built the camp. Now a refused
      launch clears it and starting from the prep panel always clears it. Browser check: `expedicao.spec.ts`.
- [x] 5.1 (camp part) + 5.2, step A (2026-10-17): a chest next to the tent in the camp scene (`CPS.bau`,
      `campBauMesh`). E near it opens the field backpack with a "📦 Baú do acampamento" window (`econ.stash`, a `bau`
      entry in `ui/recipientes.ts`: drag, right click goes to it, it shows only while near the chest). E near the tent
      (`campNear` → "tenda", nearest of the two wins) opens the prep panel without leaving the camp (`openPrep` accepts
      the hero in the camp; the panel moves into `#dungeon-view` while open and back on close); "Partir" from there
      leaves the camp and enters the expedition. Actions panel: "Abrir o baú", "Preparar a expedição". Browser check:
      `acampamento-bau.spec.ts`.
- [ ] Step B, 5.3 Combined prep panel: chest grid and the anteater's cargo in the prep panel, summary before leaving
      (no destination: the game has no destination choice yet).

- [x] Resources (stone, feather, eagle feather) go to the backpack first, the quiver only when the backpack has no room
      (`resAddBase`/`placeRes` tried the quiver first). `inventario.spec` t5 updated for the new rule.

## Backpack as an item (maintainer's decision, 2026-10-17)

Decided: the anteater's cargo stays in cells; the backpack and the quiver become equippable/unequippable items; a closed
backpack takes 6×6 cells, a closed quiver 3×6; the cargo is a fixed 18×12 (= 4 backpacks + 2 quivers); the heroine
starts with 1 backpack and 1 quiver, extras from the market or the carpentry; all backpacks the same size for now.

- [x] Part 1, the backpack (`src/items/mochilas.ts`, item `eq_mochila`, slot `equip.mochila` outside `EQ_SLOTS`): worn, its
      contents are `h.inv` as always; stored, the item carries `it.conteudo` and `h.inv` becomes a 0×0 grid (what she
      gains goes to the quiver/chest/ground, like a full backpack). Never both at once (the save is JSON). A backpack doesn't
      go into a backpack or the quiver (`canPlace`/`placeIn`). Old saves: no slot → a worn backpack with the old contents.
      Field: "Mochila" slot on the doll (click = store in the saddlebags if the anteater is near, else the ground; right
      click = ground); drag a backpack onto the slot to wear/swap; E on a backpack on the ground wears it if she has none.
      Prep: a "Mochila" slot next to the reserve weapons (click = store in the chest). No backpack = "Sem mochila" notice in
      the grid. Painted icon `btn_mochila`. Browser check: `mochila-item.spec.ts` (incl. save/load without duplicating).
- [x] Part 2 (2026-10-17): in the field, the item menu of a stored backpack has "🎒 Abrir (N itens)": a draggable window
      "Mochila guardada" (`abrirMochilaGuardada`/`montarMochilasAbertas` in `ui/recipientes.ts`) whose grid joins
      `INV.invGrids`, so drag and right click work as in the other windows.
- [x] Part 5, backpack only (2026-10-17, prices accepted): the prep shop "🎒 Mochila extra — 40💰" and the carpentry recipe
      "🎒 Mochila" (3 peles + 1 corda; `ReceitaCarp.corda`) put an empty backpack in the chest. Table `MOCHILA` in
      `data/itens.ts`. Browser check: `mochila-item.spec.ts` (4 tests).
- [x] Part 3 (2026-10-17): the quiver as an item `eq_aljava` (slot `equip.aljava`, 3×6 closed), same module
      (`items/mochilas.ts`: `equiparBolsa`/`desequiparBolsa`/`vestirBolsa`/`migrarBolsas`, table `BOLSAS`). Stored, it
      carries its contents and the arrow total (`it.flechas`, the arrow packs leave the contents; `econ.quiver.n` drops
      to 0, `arrowCap` = 0, `qvInv` = 0×0 with the "Sem aljava" notice); worn again, the total comes back and `qvSync`
      redraws the packs. Doll and prep slot "Aljava"; prep shop "🏹 Aljava extra — 25💰"; carpentry "🏹 Aljava"
      (2 peles + 1 galho; `ReceitaCarp.extra` = other cost items). Quiver upgrades (`econ.quiver.type`) stay global.
      Icon: alias `flecha_pacote` (no painted quiver icon yet). Browser check: `mochila-item.spec.ts` (6 tests).
- [-] Part 4 dropped (maintainer, 2026-10-17): the anteater's cargo keeps growing with its level, as before.
- [ ] Later: opening a stored backpack from the chest/prep (only in the field for now); opening a stored quiver.

## Block 6: map navigation (started 2026-10-17, maintainer's priority over the rest of Block 4)

Decisions (maintainer, 2026-10-17): RTS controls (left = select/inspect, left drag on empty ground = selection box,
right = order; middle drag and screen edge move the camera); WASD/arrows move the camera, Space centers, F toggles
follow; entering the field keeps the "max zoom enters" feel: only on the selected heroine (ring only with the cursor on
her), a continuous transition into the 3D field, symmetric exit by zooming out in the field, E as a shortcut.

- [x] Part 1, performance (2026-10-17). Measured (SwiftShader, after the intro, heroine on the map): idle 15 fps,
      panning 6–10, zoom 2–7; under 10% of the frame was game code, the rest was raster of three full-screen canvases.
      Changes: the vector map tiles live in `#map-ladrilhos` (one canvas per tile, placed in world units, moved and scaled
      by the GPU with the camera transform in `applyCameraTransform`; the overview `MAPART.ov` is the background; while
      zooming the old level stays under the new one until it is ready); `MAPART.cv` only keeps the quadrant grid and
      labels. Map drawing skips what is off screen (`naVista`/`medirVista` in `render/desempenho.ts`: plants, carcasses,
      animals, wild, nodes, runes); plant alpha in steps (color cache hits); the fog is drawn at 1/4 resolution and only
      redrawn when it changes. After: idle 20, panning 20, zoom 20 (the main thread is now ~33% idle; the rest is
      SwiftShader compositing). Known failing map specs, not from this: t4 (title screen covers the click), t51, t77.
- [x] Smooth movement (2026-10-17, the maintainer still felt it "travado"): the simulation moves heroes walking to a
      click, animals and birds only 4 times per second at 1x (`CONFIG.TICKS_PER_SEC_BASE`), so they hopped and the
      following camera chased a jumping target. `render/interpolar.ts` keeps where each one was before the last tick
      (a WeakMap, outside the save) and `loop` draws each one between the two ticks (`usarVisual`/`voltarReal` around
      `renderFrame`); the follow camera and the path line use `posVisual`. Moves made outside the ticks (WASD,
      teleports) are drawn where they are.
- [x] Part 2, RTS controls (2026-10-17, `map/selecao.ts`, CSS `40_v7.7_mapa_rts.css`, table `RTS` in `data/mapa.ts`),
      mouse only (touch keeps the old drag-to-pan and tap-to-walk): left click selects a hero (clicking her again opens
      her menu, as before) or inspects; left click on empty ground clears the selection; left drag = selection box
      (no Shift); right click = order for the selection (or the map heroine): ready rock/tree = gather (minigame on
      arrival), camp = go there, ground = walk, with a green marker; middle drag and the window edge move the camera;
      WASD/arrows move the camera with easing (`moverCameraRts`, the heroine no longer walks with them); Space centers
      on the selection; F toggles follow (the camera starts free; walking no longer re-locks it); Ctrl+1..9 stores a
      group, 1..9 selects it (twice: centers). Browser check: `selecao.spec.ts` (rewritten); `mapa.spec` tbase/t77
      updated (first click selects, second opens the menu; F to follow; middle drag).
- [x] Parts 1 and 2 + smooth movement **approved** by the maintainer after playing (2026-10-18: "mapa muito melhor").
- [x] Part 3, entering/leaving the field (2026-10-18, `map/transicao.ts`, CSS `41_v7.7_transicao_campo.css`;
      **approved** by the maintainer after playing, 2026-10-18). Entry: at max map zoom, scrolling in only counts with the cursor on a **selected**
      heroine (the ring fills on her, `JOGO.alvo`; elsewhere a tip says how, at most every 4 s); E on the map does the
      same for the selected heroine (touch has no selection: the map heroine under the pinch, wider radius). The map
      camera goes to her, keeps zooming past the max by scaling `#viewport` with CSS (no tile redraw), the screen darkens
      (`#zoom-veu`), the field opens with the camera high (`CZ.voo`, ×0.4) and it descends over 1.1 s from the second
      field frame (the first one builds the scene); the veil clears then. No golden portal (`launchDungeon(id, true)`).
      Exit, symmetric: scrolling out at the farthest field zoom raises the camera a little as it accumulates (`CZ.saida`,
      up to 30%) with a "continue rolando para voltar ao mapa" tip and progress ring (`#saida-dica`); at the threshold
      the camera rises to ×0.4, the screen darkens, the map comes back at max zoom scaled ×2.6 on her and eases out, then
      zooms out to the previous level (`exitDungeon(cb)`). At a heroine on the camp (idle) it enters the camp as before.
      Values in `TRANS` (`map/transicao.ts`). Browser check: `transicao-campo.spec.ts`.
- [ ] Part 4: levels of detail (icons far, thumbnails near).
- [x] 7.4 Hunter idle (2026-10-18): his "parada" was a single frozen frame of the walk (the plan had no idle clip);
      now it is `idle.fbx` from `Locomotion Pack caçador.zip`, retargeted (`bindMixamo` = that zip's T-pose) in
      `tools/modelos/cacador_animacoes.json`. The other clips are byte-identical. Browser check: `cacador.spec.ts`.
- [ ] 7.4/7.5 Intro skip vs. boss defeat, natural runes only after the boss. **P** The rabbit boss doesn't exist in the
      game yet: the intro fight is the "Javali Alfa" (the rabbit only appears in the opening cinematic), and the
      Lebre Rúnica is campaign Act 10 (`docs/campanha.md` C7). Today skipping the intro marks no boss defeat (there is no
      such flag). Gating the natural runes on a boss that can't be fought yet would turn them off for the whole game
      (absorption, rune forge). Which event counts: the Javali Alfa, a new rabbit fight in the intro, or Act 10? The
      option to turn off all natural runes already exists (Options → "✨ Runas Naturais", `OPT.runas`).
- [x] Hit reaction + shield block on the animated heroine (2026-10-18): the renderer passes `atingido` (from
      `d.hurtFlash`, 0.45 s) and `bloqueou` (from `d._blqEm`) to `heroinaAnimada`. Browser check: `heroina.spec.ts`
      ("reação ao levar dano e bloqueio com escudo").

## Blocks 5 and 7

Not inspected yet. Next in order: Block 2 (HUD) together with Block 3 (inventory), then 4/5 (camp, chest, preparation,
anteater), 6 (map, intro, runes) and 7 (death, loot, polish).
