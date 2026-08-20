import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

async function request(method, path, { key, body } = {}) {
  const response = await exports.default.fetch(new Request(`https://worker.test${path}`, {
    method,
    headers: {
      ...(key ? { "x-api-key": key } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
  return { status: response.status, body: await response.json() };
}

async function signup(email) {
  const response = await request("POST", "/v2/auth/signup", { body: { email } });
  expect(response.status).toBe(201);
  return response.body;
}

describe("banking API in the Workers runtime", () => {
  it("keeps customers and events tenant-isolated", async () => {
    const tenantA = await signup("worker-a@example.test");
    const tenantB = await signup("worker-b@example.test");
    const customer = await request("POST", "/v2/customers", {
      key: tenantA.key,
      body: { type: "individual", name: "Worker tenant A" },
    });
    expect(customer.status).toBe(201);

    expect((await request("GET", `/v2/customers/${customer.body.id}`, { key: tenantB.key })).status).toBe(404);
    const eventsB = await request("GET", "/v2/events", { key: tenantB.key });
    expect(eventsB.status).toBe(200);
    expect(eventsB.body.data.some((event) => event.data?.id === customer.body.id)).toBe(false);
  });
});
