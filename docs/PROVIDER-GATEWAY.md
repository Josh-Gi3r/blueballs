# Production provider gateway protocol

Blueballs core is provider-neutral. A production deployment connects its bank,
card processor, identity/KYC system, custody provider or other regulated service
through a deployment-owned provider gateway.

The gateway is an adapter boundary, not a second banking core. Blueballs owns
canonical resource state, ledger state, idempotency, retry/reconciliation state
and audit correlation. The gateway translates provider-specific APIs and
callbacks into the protocol below.

## Configuration

```text
BANK_API_MODE=production
BANK_PROVIDER_GATEWAY_URL=https://provider-gateway.example.org/blueballs
BANK_PROVIDER_GATEWAY_TOKEN=<secret from deployment secret manager>
```

Blueballs refuses a provider-dependent production command with `503` when no
provider transport is configured. It does not accept a transfer/card/receiving
instrument/KYC submission that can never leave the local database.

The HTTP gateway must use HTTPS. Loopback HTTP is available only for local tests
when `BANK_PROVIDER_ALLOW_INSECURE_LOCALHOST=true`.

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
not turn retries into a second payment, second card or second external resource.

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

HTTP `429` is retried in the same phase with the same `job_id`. Network errors,
HTTP `408`, unstructured `5xx`, redirects and malformed successful responses are
ambiguous because the provider may already have acted.

## Transfer funds state

For `payments.transfer`, the gateway should use:

| `funds_state` | Meaning |
| --- | --- |
| `not_sent` | Provider definitively did not send/accept funds. A local refund is safe. |
| `rejected_before_submission` | Instruction was rejected before external funds movement. A local refund is safe. |
| `submitted` | External submission happened but finality is not known. |
| `settled` | External settlement is final under the provider/rail contract. |
| `returned` | Previously submitted funds have definitively returned. A local refund is safe. |
| `unknown` | Provider-side funds position is not proven. Manual/automated reconciliation is required. |

A transfer `outcome: "succeeded"` must represent final settlement and should
return `funds_state: "settled"`. "Request accepted" is `pending`, not
`succeeded`.

Blueballs never refunds a failed/ambiguous transfer merely because an HTTP call
failed. It only automatically returns the reserved local balance when the
provider proves a safe funds state such as `not_sent`,
`rejected_before_submission` or `returned`.

## Current capability contracts

### `payments.transfer` / `submit`

Input payload contains the canonical transfer, plus the selected recipient and
destination where available. A final success settles the internal provider
clearing reservation to an external-settlement account.

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
result returns `result.instrument` with the canonical safe receiving fields.

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

- Keep gateway credentials in deployment secret storage.
- Do not put credentials in provider payloads or adapter results.
- Never log full request/response payloads by default; they may contain customer
  or payment information.
- Use least-privilege provider credentials per deployment/environment.
- Verify provider callbacks independently and map them into the same stable
  `job_id`/`provider_reference` reconciliation record.
- Encrypt provider/outbox databases and backups at rest when payloads contain
  regulated or personal data.
- Never expose provider-specific raw errors directly to customers. Map them to
  canonical states and stable error codes.

See [ADAPTER-STANDARD.md](ADAPTER-STANDARD.md) for the wider adapter maturity and
conformance standard.
