import assert from "node:assert/strict";
import test from "node:test";
import {
  handleGrowthEvent,
  logServerGrowthEvent,
} from "./growth-events.js";

const env = { BLUEBALLS_GIT_SHA: "test-sha" };

test("growth event intake accepts an allowlisted event and logs bounded structured data", async () => {
  const lines = [];
  const original = console.log;
  console.log = (line) => lines.push(line);
  try {
    const response = await handleGrowthEvent(
      new Request("https://blueballs.tech/api/events", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://blueballs.tech",
          referer: "https://blueballs.tech/ecosystem?utm_source=test",
        },
        body: JSON.stringify({
          name: "provider_shortlist",
          path: "/ecosystem",
          session_id: "session-test",
          attribution: { source: "launch", medium: "social" },
          properties: {
            provider: "example-provider",
            shortlist_size: 2,
            ignored_nested: { secret: "not-logged" },
          },
        }),
      }),
      env,
    );

    assert.equal(response.status, 204);
    assert.equal(lines.length, 1);
    const event = JSON.parse(lines[0]);
    assert.equal(event.type, "blueballs_growth_event");
    assert.equal(event.name, "provider_shortlist");
    assert.equal(event.properties.provider, "example-provider");
    assert.equal(event.properties.shortlist_size, 2);
    assert.equal(event.properties.ignored_nested, undefined);
    assert.equal(event.referrer_host, "blueballs.tech");
    assert.equal(event.source_commit, "test-sha");
  } finally {
    console.log = original;
  }
});

test("server-confirmed Builder signals use canonical low-cardinality paths", () => {
  const lines = [];
  const original = console.log;
  console.log = (line) => lines.push(line);
  try {
    const accepted = logServerGrowthEvent(
      new Request(
        "https://blueballs.tech/v2/builder/projects/project-secret/provision",
      ),
      env,
      "builder_sandbox_provisioned",
      { response_status: 200 },
    );
    assert.equal(accepted, true);
    const event = JSON.parse(lines[0]);
    assert.equal(event.name, "builder_sandbox_provisioned");
    assert.equal(event.path, "/v2/builder/projects/:id/provision");
    assert.equal(event.properties.response_status, 200);
    assert.doesNotMatch(event.path, /project-secret/);
  } finally {
    console.log = original;
  }
});

test("growth event intake rejects unknown event names", async () => {
  const response = await handleGrowthEvent(
    new Request("https://blueballs.tech/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "arbitrary_event" }),
    }),
    env,
  );
  assert.equal(response.status, 400);
});

test("growth event intake rejects cross-origin browser submissions", async () => {
  const response = await handleGrowthEvent(
    new Request("https://blueballs.tech/api/events", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://example.com",
      },
      body: JSON.stringify({ name: "provider_directory_view" }),
    }),
    env,
  );
  assert.equal(response.status, 403);
});

test("growth event intake rejects non-POST requests", async () => {
  const response = await handleGrowthEvent(
    new Request("https://blueballs.tech/api/events"),
    env,
  );
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
});

test("growth event intake rejects oversized payloads", async () => {
  const response = await handleGrowthEvent(
    new Request("https://blueballs.tech/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "provider_search",
        properties: { value: "x".repeat(5000) },
      }),
    }),
    env,
  );
  assert.equal(response.status, 413);
});
