import assert from "node:assert/strict";
import test from "node:test";
import { navigatePath } from "../../src/router-core.ts";

function runtime(pathname = "/home") {
  const actions = [];
  const events = [];
  return {
    actions,
    events,
    value: {
      pathname,
      pushState: (path) => actions.push(["pushState", path]),
      broadcastLocationChange: () => actions.push(["popstate"]),
      scrollToTop: () => actions.push(["scroll", 0, 0]),
      track: (name, properties = {}) => events.push({ name, properties }),
    },
  };
}

test("same-route navigation only resets scroll", () => {
  const browser = runtime("/home");
  const result = navigatePath("/home", browser.value);

  assert.deepEqual(result, {
    changed: false,
    sourcePath: "/home",
    destination: "/home",
    growthEvent: null,
  });
  assert.deepEqual(browser.actions, [["scroll", 0, 0]]);
  assert.deepEqual(browser.events, []);
});

test("cross-shell navigation pushes a real URL then broadcasts location change", () => {
  const browser = runtime("/home");
  const result = navigatePath("/cards", browser.value);

  assert.equal(result.changed, true);
  assert.equal(result.growthEvent, null);
  assert.deepEqual(browser.actions, [
    ["pushState", "/cards"],
    ["popstate"],
    ["scroll", 0, 0],
  ]);
  assert.deepEqual(browser.events, []);
});

test("Builder navigation attributes the source path before changing location", () => {
  const browser = runtime("/blueprint");
  const result = navigatePath("/sandbox", browser.value);

  assert.equal(result.growthEvent, "builder_start");
  assert.deepEqual(browser.events, [
    {
      name: "builder_start",
      properties: { source_path: "/blueprint" },
    },
  ]);
  assert.deepEqual(browser.actions, [
    ["pushState", "/sandbox"],
    ["popstate"],
    ["scroll", 0, 0],
  ]);
});

test("commercial navigation attributes the source path", () => {
  const browser = runtime("/proof");
  const result = navigatePath("/contact", browser.value);

  assert.equal(result.growthEvent, "commercial_contact_view");
  assert.deepEqual(browser.events, [
    {
      name: "commercial_contact_view",
      properties: { source_path: "/proof" },
    },
  ]);
});
