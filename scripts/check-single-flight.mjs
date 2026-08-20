#!/usr/bin/env node
import assert from "node:assert/strict";
import { createSingleFlight } from "../src/singleFlight.js";

let calls = 0;
let release;
const gate = new Promise((resolve) => { release = resolve; });
const run = createSingleFlight(async () => {
  calls += 1;
  await gate;
  return "bb_test_one";
});

const first = run();
const second = run();
assert.strictEqual(first, second, "concurrent callers must receive the same promise");
release();
assert.deepEqual(await Promise.all([first, second]), ["bb_test_one", "bb_test_one"]);
assert.equal(calls, 1, "concurrent callers must execute one signup");

await run();
assert.equal(calls, 2, "a settled flight must not stay cached forever");
console.log("single flight: two concurrent callers execute one signup and the cache resets");
