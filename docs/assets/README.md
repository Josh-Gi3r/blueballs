# Repository visual assets

## README product imagery

The README hero and gallery are readable crops of actual local product captures.
Their source images, crop sizes and publication role are recorded in
[`readme/`](readme/). Full-page and mobile QA evidence remains in
[`screenshots/`](screenshots/) and is linked rather than rendered in the README.

## System map

`blueballs-system-map.svg` is deterministic, source-derived documentation. Its
labels must stay aligned with the API catalogue, FX runtime and provider status.
Unlike the hero, it is a factual architecture graphic and is checked by
`scripts/check-doc-evidence.mjs`.

Browser evidence and its capture metadata live in [`screenshots/`](screenshots/).
