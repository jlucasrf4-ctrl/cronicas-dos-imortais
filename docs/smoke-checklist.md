# Smoke checklist (manual play-test)

Use this after each roadmap step to confirm the game still works and looks the same.
Open the new build and the reference (`reference/game_v7.6.html`) **side by side** in the same browser
(Chrome or Edge) and compare. It takes about 10–15 minutes; for small steps, do only the sections the step touched.

**Before you start:** press **F12 → Console** in both tabs. Any red error in the new build that the reference doesn't show is a failure, even if the game looks fine.

> Saves live in the browser's storage, per file location. To test with no save, use a private window.
> To test that **old saves still load**, play the reference first, save, then open the new build from the **same folder path** (rename or swap files), since storage is tied to the file's path.

## 1. Boot and title
- [ ] The title screen shows "Crônicas dos Imortais" over the dark map, with the rune circle animation and `v7.6 · …` at the bottom.
- [ ] Fonts look the same (Cinzel title, Lora text). They need internet, as the fonts come from Google Fonts.
- [ ] Clicking or pressing a key opens the menu. New game, Continue and Options show up as in the reference.

## 2. New game: story, creation, opening scene
- [ ] The story/intro text plays (tapping or clicking speeds it up).
- [ ] Character creation scene: type a name and confirm. The hero is revealed with attributes and affinity.
- [ ] Opening scene (playable): the boar circles, and you shoot with the bow (hold, then release to fire). The Caçador (hunter) dialogue appears. **Space / E / Enter** advance the dialogue.
- [ ] After the scene, you land on the world map.

## 3. World map
- [ ] The map renders crisp at different zoom levels (mouse wheel). The fog appears at the edges instead of a hard zoom wall.
- [ ] Clicking moves the hero, with a path line to the destination. **WASD** also works. The camera follows the hero.
- [ ] **C** centers on the camp, and **V** centers on the hero.
- [ ] The clock/day/phase box counts up. Animals and other markers move on the map.
- [ ] Vila Musgo (the town) opens its shop when clicked: buy and sell something.

## 4. Field / expedition (the 3D view)
- [ ] Enter the field (click the hero → expedition / ⚔, or the ring that enters the field). The 3D low-poly scene appears with sun shadows and outlines, as in the reference.
- [ ] Move with **WASD** (**Shift** runs). The stamina circle drains and refills.
- [ ] **Left click** attacks. **Right click** does the weapon's alternate action (heavy blow / throw / bow roll). **Space** guards or dodges.
- [ ] **Q** switches weapon, **X** knife stab (hold to stick it in, release to pull out), **G** throws the rope/lasso. **Tab** cycles target. **H** uses an herb.
- [ ] Kill an animal (rabbit/deer/boar): you get damage numbers and icons, then loot, and **E** collects or finishes it.
- [ ] Get hit: the HP bar drops and the hit effects show.
- [ ] Birds land and fly off, and branches lie on the ground to pick up.

## 5. Inventory and crafting
- [ ] **I** opens the backpack: the grid, quiver and ground panel side by side, plus the equipment doll.
- [ ] Drag an item. **R** rotates while dragging. Shift+drag splits off 1, and right click drops an item.
- [ ] Hovering an item shows the tooltip (quality, damage, durability, weight, value).
- [ ] Item icons are painted art (not emoji), except the tamanduá ones, which are known to be missing.
- [ ] **C** opens crafting, and Analisar (analyze) works from the item menu.
- [ ] **K** opens the character sheet (attributes, skill trees, proficiencies).

## 6. Camp and survival
- [ ] Open the camp on the map: tent, fire, anvil, chest, tool case and table are all drawn.
- [ ] Cook meat on the fire: the glow, sound and roast animation play.
- [ ] Forge minigame at the anvil (**Space** to strike, **F** for the bellows). Carpentry and the analysis table open.
- [ ] The chest opens. **R** rotates items and **Esc** closes it.

## 7. Save / load and options
- [ ] **Esc** opens the pause menu. Save, then reload the page and Continue: hero, items, position and time all restore.
- [ ] Change an option (for example the 3D or touch-control settings). It still applies after a reload.

## 8. Mobile layout (optional)
- [ ] F12 → device toolbar (phone size), or a real phone: the touch joystick and buttons appear, pinch zoom works on the map, and tapping advances the dialogue.

## Result
Record the date, the roadmap step and any differences found, for example at the bottom of ROADMAP.md or in your own notes.
