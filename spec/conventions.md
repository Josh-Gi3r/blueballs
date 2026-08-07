# Greenbar API conventions — FROZEN CONTRACT (Wave 0)

Every resource family in `openapi.yaml` obeys these. Adapters and screens are written against
this, not against any provider. **Freeze before fan-out** — changing anything here invalidates
in-flight work in every other wave.

## Transport
| Rule | Value |
|---|---|
| Base | `https://api.greenbar.dev/v2` · sandbox `https://sandbox.api.greenbar.dev/v2` |
| Auth | `x-api-key` header |
| Versioning | URL path (`/v2`) |
| Timestamps | RFC 3339 with explicit offset |
| Content type | `application/json`; errors `application/problem+json` |

## Identifiers
Type-prefixed KSUID — 27-char base62, sortable and opaque.
`cus_` customer · `app_` application · `acc_` account · `adt_` account details · `wal_` wallet ·
`rcp_` recipient · `dst_` destination · `quo_` quote · `trf_` transfer · `leg_` transfer leg ·
`crd_` card · `aut_` authorisation · `dsp_` dispute · `vlt_` vault · `crl_` credit line ·
`pol_` policy · `apc_` approval chain · `org_` org · `evt_` event · `whk_` webhook target ·
`sim_` simulation · `key_` api key

Every mutable resource also accepts a caller-supplied `client_reference_id`.

## Money
Never a float. Always a decimal **string** plus an explicit currency.
```json
{ "amount": "2400.00", "currency": "EUR", "settlement_currency": "USDX" }
```
`settlement_currency` is separate from `currency` and MUST stay separate — collapsing them is
what produces a UI claiming a user spent dollars when they spent a stablecoin.

## Idempotency
`x-idempotency-key` on every POST. Replay with the same key returns the cached response.
Replay with the same key but different parameters returns `409 conflict`.

## Pagination
Cursor: `starting_after`, `ending_before`, `limit`. Never offset.

## Errors — RFC 9457 Problem Details
```json
{ "type": "compliance-blocked", "title": "Blocked by screening", "status": 422,
  "detail": "Recipient matched a sanctions list.", "instance": "/v2/transfers/trf_2p…",
  "request_id": "req_2p…", "errors": [{ "field": "recipient", "message": "…", "code": "…" }] }
```

| type | status | notes |
|---|---|---|
| `validation-error` · `invalid-request` · `invalid-identifier` | 400 | |
| `insufficient-balance` | 400 | |
| `limit-exceeded` | 400 | transaction limits AND resource quotas |
| `below-minimum` | 400 | minimums are per route |
| `authentication-error` | 401 | |
| `forbidden` | 403 | permissions |
| `tier-insufficient` | 403 | KYC tier block — distinct from permissions |
| `not-found` | 404 | |
| `conflict` | 409 | |
| `quote-expired` | 409 | |
| `payload-too-large` | 413 | |
| `compliance-blocked` | 422 | screening hit — NEVER folded into 403 |
| `rail-unavailable` | 422 | cutoff, weekend, holiday, scheme outage |
| `rate-limited` | 429 | |
| `internal-error` | 500 · `not-implemented` 501 · `provider-error` 502 · `service-unavailable` 503 | |

`provider-error` at 502 keeps upstream adapter failure visible instead of hiding it in a 500.

## Rate limits
Headers on every response: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`;
`Retry-After` on 429. Defaults: api key 60/min · dashboard token 600/min · unauthenticated 10/min.

## Transfer state machine
Forward-only spine:
`created → awaiting_funds → funds_received → submitted → confirming → settled`

`confirming` stays a distinct state — a hash at submission is preliminary, and a UI must never
present it as final.

Exception branches:

| state | terminal | entered from |
|---|---|---|
| `in_review` | no | any pre-submission |
| `compliance_hold` | no | any pre-submission |
| `undeliverable` | yes | `submitted` |
| `rejected` | yes | `in_review`, `compliance_hold` |
| `failed` | yes | any non-terminal |
| `timed_out` | yes | `confirming` |
| `canceled` | yes | `created`, `awaiting_funds` only |
| `returned` | yes | `settled` |
| `reversed` | yes | `settled` |
| `refund_pending` | no | `returned` |
| `refunded` | yes | `refund_pending` |
| `refund_failed` | yes | `refund_pending` |

A transfer carries an ordered `legs[]`; transfer status is **derived** from the legs.

## Lifecycle vs. outcome
Application `status` (`pending`/`submitted`/`completed`/`compliance_review`) is separate from
`decision` (`approved`/`declined`/`withdrawn`). A completed-and-declined review is a completely
different screen from a review still running.

## Webhooks
Dotted, resource-first event names (`transfer.status_changed`). Common envelope: event id, type,
created, api version, delivery id, and `data` carrying the full resource plus `previous_status`
/ `current_status` on changes. Replays carry `X-Webhook-Replay: true`. Delivery history 30 days.

## Sandbox
Scenario catalogue endpoint so names are discoverable without reading source. Simulations are
idempotent on `simulation_id`, may pause with `awaiting_advance: true`, and are stepped past a
pause with an advance call. The catalogue is provider-independent so the conformance kit can
assert every adapter handles every scenario.

## Adapters
No provider name appears in this spec, in the SDKs, or in the docs. A provider is configuration.
The FX rail, the card processor and the fiat rails are each **pluggable adapters** behind these
resources; the stack never depends on one vendor. Adapter capability gaps are expressed through
the model (e.g. a quote that cannot be locked sets `lockable: false`), never by changing it.
