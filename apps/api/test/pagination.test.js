import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const dir = mkdtempSync(join(tmpdir(), "blueballs-pagination-"));
process.env.DB_PATH = join(dir, "pagination.sqlite");
const { paginate } = await import("../src/kernel.js");
const rows = ["a", "b", "c", "d", "e"].map((id) => ({ id }));

test.after(() => rmSync(dir, { recursive: true, force: true }));

test("ending_before returns the immediately preceding page", () => {
  const page = paginate(
    rows,
    new URL("https://example.test/items?ending_before=e&limit=2"),
  );
  assert.deepEqual(
    page.data.map(({ id }) => id),
    ["c", "d"],
  );
  assert.equal(page.has_more, true);
  assert.equal(page.next_cursor, "c");
});

test("pagination rejects conflicting cursors and invalid limits", () => {
  assert.throws(
    () =>
      paginate(
        rows,
        new URL("https://example.test/items?starting_after=a&ending_before=e"),
      ),
    /starting_after or ending_before/,
  );
  assert.throws(
    () => paginate(rows, new URL("https://example.test/items?limit=0")),
    /positive integer/,
  );
});
