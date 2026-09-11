# Provider inbound settlement protocol

Blueballs accepts provider-originated **settled financial facts** through a
private service endpoint. This surface can create customer balance, so it has a
stricter trust boundary than ordinary tenant APIs.

## Endpoint

```text
POST /internal/provider/events
X-API-Key: <operator credential>
Content-Type: application/json
```

The route is not part of the public `/v2` catalogue or public OpenAPI. It should
also be restricted at the deployment network/service layer.

## Two independent authentication controls

A valid request requires both:

1. the deployment operator credential protecting the private route; and
2. a dedicated HMAC signature embedded in the provider event body.

Do not reuse the operator credential as the HMAC secret.

Configure:

```text
BANK_PROVIDER_INBOUND_SECRET=<at least 32 characters from secret manager>
BANK_PROVIDER_INBOUND_MAX_SKEW_SECONDS=300
```

The body contains:

```json
{
  "event_id": "bank-event-000001",
  "tenant_id": "ten_...",
  "type": "payments.account_credit_settled",
  "resource_id": "acc_...",
  "amount": { "amount": "125.37", "currency": "EUR" },
  "provider_reference": "bank-credit-123",
  "provider_state": "settled",
  "authentication": {
    "timestamp": "1789123456",
    "signature": "v1=<64-hex-hmac-sha256>"
  }
}
```

The signature is HMAC-SHA256 over:

```text
<timestamp>.<canonical JSON payload excluding authentication>
```

Canonical JSON recursively sorts object keys and preserves array order. The
runtime uses constant-time signature comparison. Timestamps outside the allowed
clock skew are rejected with `401`.

A deployment gateway should verify the original bank/custodian/vendor callback
using that provider's own authentication first, normalize it into the Blueballs
canonical event, then sign the canonical event with the dedicated Blueballs
inbound secret.

## Replay and idempotency

`event_id` is the durable financial idempotency identity.

- Same `event_id` + same canonical evidence: return the original record with
  `replayed: true`; no second ledger posting.
- Same `event_id` + different canonical evidence: `409`; no ledger posting.
- A legitimate retry may carry a fresh timestamp/signature. Authentication
  metadata is deliberately excluded from the durable evidence fingerprint.

Never use a timestamp or HTTP request ID as the financial idempotency identity.

## Supported settled facts

### `payments.account_credit_settled`

Required controls:

- tenant exists;
- account is owned by that tenant;
- account is not closed;
- amount is a positive exact decimal money value;
- currency exactly matches the account;
- provider event signature is valid and fresh;
- event ID has not been used for different evidence.

The accepted event posts balanced ledger entries from the external inbound rail
account to the customer account and emits `account.payment_received`.

### `custody.wallet_deposit_settled`

Required controls:

- tenant exists;
- wallet is owned by that tenant and active;
- amount is positive exact money;
- currency exactly matches the wallet;
- provider event signature is valid and fresh;
- event ID replay rules pass.

The accepted event posts balanced ledger entries from the external custody
network account to the canonical wallet and emits `wallet.deposit_settled`.

## What must not be sent as settled

Do not translate any of these into a settled event:

- mempool observation;
- card/payment authorization;
- payment initiation;
- provider acknowledgement without settlement finality;
- blockchain transaction below the institution's finality policy;
- provisional credit that can still be reversed under the connected rail;
- a webhook whose provider signature could not be verified.

If provider finality is not established, keep the state in the deployment-owned
adapter/reconciliation system until it can produce a canonical final event.

## Rotation

HMAC rotation is a coordinated deployment change:

1. generate a new high-entropy secret in the secret manager;
2. stage the gateway/runtime rollout so the active signer and verifier agree;
3. verify signed-event conformance in staging;
4. roll production runtime and provider gateway;
5. send a signed non-monetary/staging probe where the deployment supports it;
6. retire the old secret only after old gateway instances are fenced.

The current protocol accepts one active inbound secret. Use deployment rollout
coordination rather than silently accepting unlimited historical secrets.

## Audit evidence

Accepted/failed commands receive a Blueballs `command_id` and structured audit
record. Retain the provider `event_id`, `provider_reference`, command ID and
upstream provider audit/callback evidence together for incident/reconciliation
work. Do not persist the HMAC secret or arbitrary upstream raw payloads in audit
records.
