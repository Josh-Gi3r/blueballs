import assert from "node:assert/strict";
import test from "node:test";
import { createApiFixture } from "./helpers/api-process.js";

test("QR decode rejects duplicate EMVCo tags before field selection", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());

  const generated = await api.request("POST", "/v2/qr/generate", {
    body: {
      merchant_name: "Blueballs Test",
      merchant_city: "Singapore",
      country: "SG",
      currency: "SGD",
      amount: "12.34",
      mcc: "5734",
    },
  });
  assert.equal(generated.status, 200);

  const payload = generated.body.payload;
  const crcTagStart = payload.length - 8;
  const ambiguous = `${payload.slice(0, crcTagStart)}5901X${payload.slice(crcTagStart)}`;

  const decoded = await api.request("POST", "/v2/qr/decode", {
    body: { payload: ambiguous },
  });
  assert.equal(decoded.status, 400);
  assert.equal(decoded.body.type, "validation-error");
  assert.match(decoded.body.detail, /duplicate tag 59/i);
  assert.equal(decoded.body.errors?.[0]?.code, "duplicate_tag");
});

test("QR generation rejects malformed MCC instead of normalizing it", async (t) => {
  const api = await createApiFixture();
  t.after(() => api.close());

  const response = await api.request("POST", "/v2/qr/generate", {
    body: {
      merchant_name: "Blueballs Test",
      merchant_city: "Singapore",
      country: "SG",
      currency: "SGD",
      mcc: "57-34",
    },
  });
  assert.equal(response.status, 400);
  assert.equal(response.body.type, "validation-error");
});
