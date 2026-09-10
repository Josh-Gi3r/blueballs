# Production provider gateway protocol

Blueballs core is provider-neutral. A production deployment connects its bank,
card processor, identity/KYC system, custody provider or other regulated service
through a deployment-owned provider gateway.

The gateway is an adapter boundary, not a second banking core. Blueballs owns
canonical resource state, ledger state, idempotency, retry/reconciliation state
and audit correlation. The gateway translates provider-specific APIs and
callbacks into the protocol below.

The machine-readable capability source of truth is
[`spec/provider-capabilities.mjs`](../spec/provider-capabilities.mjs). Build
verification fails when production intent, outcome and documentation surfaces
drift from that contract.

## Configuration

```text
BANK_API_MODE=production
BANK_PROVIDER_GATEWAY_URL=https://provider-gateway.example.org/blueballs
BANK_PROVIDER_GATEWAY_TOKEN=<secret from deployment secret manager>
BANK_PROVIDER_PAYLOAD_KEY=<32-byte key encoded as 64 hex chars or base64>
# or use BANK_PROVIDER_PAYLOAD_KEYS + BANK_PROVIDER_PAYLOAD_ACTIVE_KEY_ID
```

Blueballs refuses a provider-dependent production command with `503` when no
provider transport is configured. It does not accept a transfer, card,
receiving-instrument, KYC submission, custody wallet or custody transfer that can
never leave the local database.

The HTTP gateway must use HTTPS. Loopback HTTP is available only for local tests
when `BANK_PROVIDER_ALLOW_INSECURE_LOCALHOST=true`.

Provider-job payloads can contain identity, account and custody metadata. In
production Blueballs seals those payloads with AES-256-GCM before the durable
outbox row is committed. The active key ID is stored with the ciphertext so key
rotation can retain old decryption keys until no queued jobs reference them. The
payload is decrypted only immediately before the gateway request is sent. A
production job containing a plaintext test envelope is rejected.

## Request

Blueballs sends one JSON envelope:

```json
{
  "protocol_version": "2026-09-11",
  "job_id": "prv_...",
  "capability": "payments.transfer",
  "action": "submit",
  "phase": "submit",
  "resource": { "type": "transfer", "id": "trf_..." },
  "tenant_id": "ten_...",
  "command_id": "cmd_...",
  "provider_reference": null,
  "attempt": 1,
  "payload": {}
}
```

Headers include:

```text
Authorization: Bearer <BANK_PROVIDER_GATEWAY_TOKEN>
Content-Type: application/json
X-Blueballs-Provider-Protocol: 2026-09-11
X-Idempotency-Key: <job_id>
X-Blueballs-Command-Id: <original command_id>
```

`job_id` is the provider idempotency key for the complete lifetime of the
operation. The same ID is used for submission and reconciliation. An adapter must
not turn retries into a second payment, second card, second custody movement or
second external resource.

The gateway must not redirect Blueballs. Redirect responses are treated as an
ambiguous provider result.

## Phases

### `submit`

Submit the operation if the provider has not seen `job_id`. If it has already
seen the ID, return the existing provider state instead of submitting again.

### `reconcile`

Blueballs uses this after a timeout, process crash, explicit provider-pending
response or other ambiguous result. The gateway should query the provider using
`provider_reference`, `job_id` or its own persisted idempotency mapping. It must
not blindly create a new provider instruction.

## Response

A successful protocol response is JSON:

```json
{
  "outcome": "pending",
  "provider_reference": "provider-123",
  "provider_state": "processing",
  "funds_state": null,
  "retry_after_ms": 5000,
  "error_code": null,
  "result": {}
}
```

`outcome` is one of:

| Outcome | Meaning |
| --- | --- |
| `succeeded` | The canonical operation reached its final successful provider state. |
| `pending` | The provider accepted the operation but final outcome is not known. Blueballs reconciles later. |
| `failed` | The provider has a definite failure outcome. For money movement, `funds_state` determines whether a refund is safe. |
| `ambiguous` | It is not safe to say whether the provider side effect occurred. Blueballs opens/maintains reconciliation and does not blindly resubmit. |

HTTP status is part of the evidence. A non-2xx HTTP response cannot declare
financial success merely because its JSON body says `outcome: "succeeded"`.
HTTP `429` is retried in the same phase with the same `job_id`. Network errors,
HTTP `408`, HTTP `425`, `5xx`, redirects, malformed successful responses and
contradictory 4xx/success combinations are ambiguous because the provider may
already have acted.

## Money-movement funds state

`payments.transfer` / `submit` and `custody.transfer` / `submit` use the same
canonical funds vocabulary:

| `funds_state` | Meaning |
| --- | --- |
| `not_sent` | Provider definitively did not send/accept funds. A local refund is safe. |
| `rejected_before_submission` | Instruction was rejected before external funds movement. A local refund is safe. |
| `submitted` | External submission happened but finality is not known. |
| `settled` | External settlement is final under the provider/rail contract. |
| `returned` | Previously submitted funds have definitively returned. A local refund is safe. |
| `unknown` | Provider-side funds position is not proven. Manual/automated reconciliation is required. |

For either money-moving capability, `outcome: "succeeded"` requires
`funds_state: "settled"`. "Request accepted" is `pending`, not `succeeded`.
Blueballs never refunds a failed or ambiguous movement merely because an HTTP
call failed. It only automatically returns reserved local value when the
provider proves `not_sent`, `rejected_before_submission` or `returned`.

## Current outbound capability contracts

### `payments.transfer` / `submit`

Input payload contains the canonical transfer, plus the selected recipient and
destination where available. Blueballs reserves the source amount into a rail
clearing account in the same command that queues the provider operation. A final
provider success moves that clearing reservation to an external-settlement
account before the transfer becomes `settled`.

### `cards.issuing` / `issue`

A production card is created locally as `pending_issuance` with no invented PAN,
BIN, expiry or last-four digits. Provider success may return only non-sensitive
card metadata:

```json
{
  "outcome": "succeeded",
  "provider_reference": "card-provider-id",
  "result": {
    "last4": "4242",
    "bin": "555500",
    "expires": "12/29",
    "processor_token": "opaque-provider-token",
    "status": "active"
  }
}
```

Blueballs never persists PAN, CVV/CVC or PIN fields returned by a gateway.
Sensitive card-data retrieval remains a separate PCI/provider surface.

### `accounts.receiving_details` / `issue`

Production receiving instruments start `pending_provisioning`; Blueballs does not
invent an IBAN, ABA number, PayNow proxy or blockchain address. A successful
result returns `result.instrument` with a real receiving identifier such as an
IBAN, account number, proxy or on-chain address.

### `identity.verification` / `submit`

A provider infrastructure failure is not a declined customer. A successful
terminal KYC/KYB result returns:

```json
{
  "outcome": "succeeded",
  "provider_reference": "verification-id",
  "result": { "decision": "approved" }
}
```

`decision` is `approved`, `declined` or `withdrawn`. Pending/ambiguous provider
state remains `compliance_review` in Blueballs.

### `custody.wallet` / `create`

A production wallet is committed as `pending_provisioning` with `address: null`.
Blueballs does not expose the deterministic sandbox address. Final success must
include a provider-backed wallet address:

```json
{
  "outcome": "succeeded",
  "provider_reference": "custody-wallet-id",
  "provider_state": "active",
  "result": {
    "address": "0x...",
    "network": "base"
  }
}
```

Only after this evidence does the canonical wallet become `active`.

### `custody.transfer` / `submit`

A production wallet send first moves value from the wallet into
`clearing:custody` and queues a durable provider operation. The customer-visible
command is `funds_reserved`, not externally settled. Final provider success must
return `funds_state: "settled"`; Blueballs then moves the reservation to
`external:settled:custody`. Safe failures refund from custody clearing back to the
wallet. Unknown or submitted funds state opens reconciliation and never mints a
refund speculatively.

Wallet sends released by an approval chain use this same custody path; approval
execution does not bypass provider settlement.

## Provider-originated settled events

Outbound jobs are not enough for a real institution. Banks and custodians also
originate facts such as an incoming bank payment or on-chain deposit. Blueballs
accepts those through the private, operator-authenticated service endpoint:

```text
POST /internal/provider/events
X-API-Key: <operator credential>
```

This path is intentionally not part of the public `/v2` catalogue or public
OpenAPI. Deploy it only on the trusted provider/service network in addition to
operator authentication.

Current canonical inbound event types are:

### `payments.account_credit_settled`

```json
{
  "event_id": "bank-event-000001",
  "tenant_id": "ten_...",
  "type": "payments.account_credit_settled",
  "resource_id": "acc_...",
  "amount": { "amount": "125.37", "currency": "EUR" },
  "rail": "sepa_instant",
  "provider_reference": "bank-credit-123",
  "provider_state": "settled"
}
```

The event credits the tenant-owned account through balanced double-entry ledger
postings only after the provider says the credit is settled.

### `custody.wallet_deposit_settled`

```json
{
  "event_id": "custody-event-000001",
  "tenant_id": "ten_...",
  "type": "custody.wallet_deposit_settled",
  "resource_id": "wal_...",
  "amount": { "amount": "100.00", "currency": "USDC" },
  "network": "base",
  "provider_reference": "chain-tx-123",
  "provider_state": "settled"
}
```

Inbound provider `event_id` is a durable idempotency identity. Replaying the same
ID with the same canonical evidence is harmless and does not post money twice.
Reusing an ID with different evidence returns `409` and posts nothing. Tenant,
resource ownership and currency must all match before value is credited.

The current private endpoint accepts only canonical **settled** event types. A
provider adapter should not translate mempool observation, payment initiation or
other non-final evidence into one of these event types.

## Durability and reconciliation

Provider intent is stored in `providerOutbox` as part of the same local
transaction as the resource/ledger command. Attempts are recorded separately in
`providerAttempts`. Ambiguous/exhausted operations create a
`reconciliationCases` record.

Claims use a lease. If a process dies after claiming an operation, expiry of that
lease changes the next attempt to `reconcile` because Blueballs cannot know
whether the external request was sent before the crash.

Cloudflare Durable Object deployments schedule provider work with alarms. Node
self-hosted deployments use the local provider pump. Both use the same persistent
state machine.

## Security

- Keep gateway, bootstrap, operator and payload-encryption credentials in
  deployment secret storage.
- Do not put credentials in provider payloads or adapter results.
- Never log full request/response payloads by default; they may contain customer
  or payment information.
- Use least-privilege provider credentials per deployment/environment.
- Restrict `/internal/provider/events` at the network/service layer as well as
  requiring the operator credential.
- Verify the upstream provider's own callback signature/authentication in the
  deployment-owned gateway before translating it to a Blueballs canonical event.
- Retain retired provider-payload encryption keys until no durable outbox record
  references their key ID.
- Encrypt database files, snapshots and backups at the infrastructure/storage
  layer as well; field-level outbox encryption does not replace disk encryption.
- Never expose provider-specific raw errors directly to customers. Map them to
  canonical states and stable error codes.

See [ADAPTER-STANDARD.md](ADAPTER-STANDARD.md) for the wider adapter maturity and
conformance standard.
