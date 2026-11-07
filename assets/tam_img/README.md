# Missing art

The tamanduá images (`tok_*.webp`, `clean_*.webp`, `dirty_*.webp`, `rodeo_*.webp`) were not part of the export,
so the old patch that embedded them (p35) never ran. Without them the game shows emoji instead.

To add them now: put each image in `src/assets/icons/<key>.webp` and add one line per image to
`src/styles/icones-pintados.css`:  `.ico-<key>{background-image:url(/src/assets/icons/<key>.webp)}`
then run `npm run build`. (Expect `tests/unit/montagem.test.ts` to flag the new keys; update it.)
