# Golden reference (Phase 0)

Frozen output of the last patch-based build, on 2026-10-10. **Do not edit or regenerate.** Every roadmap step is
compared against these files, by play-testing ([docs/smoke-checklist.md](../docs/smoke-checklist.md)) and, from
Phase 2 on, by automated byte-for-byte checks of the extracted code.

| File | What | SHA-256 |
|---|---|---|
| `game_v7.6.html` | The game as players get it (open it in Chrome or Edge) | `e2d930f8a6442a34f45080479c369e07d6dc253516830a321c8c71be50d1a3f6` |
| `vtest_v7.6.html` | Same game plus the `window.__t` test hook, used by the browser tests on the other device | `491777ac4a2727bdbbd146a92cc91405ccdc81bdc841e7621df6f61a704703e7` |

How it was produced: `python scripts/build.py` (base v4.3 + patches p16–p71). The build is deterministic: a rebuild gives the same hash.

Known limitations of this reference, which later phases must not count as regressions:
- **p61 (icon hole fix) was not applied**, because scipy isn't installed. Some painted icons may show small transparent holes. Phase 2 ports this fix to TypeScript, so the new build may look slightly *better* there.
- The tamanduá art is missing (empty `assets/tam_img/`), so those icons fall back to emoji.

Optional (other device only): reference screenshots of the title screen, world map, creation and field can be added here as `screenshots/*.png`.
