#!/usr/bin/env node
import assert from "node:assert/strict";
import { CARD_PROGRAMS } from "../src/cards/data.ts";

assert.equal(
  CARD_PROGRAMS.length,
  41,
  "card programme count changed; review provenance intentionally",
);
assert.equal(
  new Set(CARD_PROGRAMS.map(({ id }) => id)).size,
  CARD_PROGRAMS.length,
  "card programme IDs must be unique",
);
for (const { id, sourceUrl, asOf, jurisdiction, confidence } of CARD_PROGRAMS) {
  assert.match(sourceUrl, /^https:\/\//, `${id}: sourceUrl must be HTTPS`);
  assert.match(asOf, /^\d{4}-\d{2}-\d{2}$/, `${id}: asOf must be YYYY-MM-DD`);
  assert.ok(jurisdiction.trim(), `${id}: jurisdiction is required`);
  assert.match(
    confidence,
    /^(?:high|medium|low)$/,
    `${id}: confidence is required`,
  );
}
console.log(
  `card provenance: ${CARD_PROGRAMS.length}/${CARD_PROGRAMS.length} programmes have source, date, jurisdiction and confidence`,
);
