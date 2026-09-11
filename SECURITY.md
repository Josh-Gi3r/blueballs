# Security Policy

Blueballs treats security controls as release code. Financial correctness, tenant isolation, provider finality, replay resistance, secret handling and operational recovery are enforced through executable contracts and regression tests rather than documentation alone.

## Supported line

Security fixes land on `main` and ship in the next tagged release. Each release can reproduce its assurance profile with `pnpm verify:release` from the exact checkout.

## Reporting a vulnerability

Use GitHub's **Report a vulnerability** / private security advisory interface for this repository.

Include:

- affected commit or release;
- package, contract or endpoint;
- impact and prerequisites;
- minimal reproduction;
- whether funds, authorization, policy, reservations, reconciliation, custody, provider callbacks or tenant isolation can be affected;
- suggested mitigation when known.

Do not publish exploit details, secrets, private keys, credentials or customer information in a public issue.

## Response process

Maintainers prioritize security reports ahead of feature work: reproduce, classify, create a private regression fix, run the complete release/security gate, publish the patched source and disclose when safe.

## Security engineering

The repository assurance profile includes:

- exact-money and double-entry invariants;
- tenant isolation and resource lifecycle tests;
- idempotency and replay protection;
- concurrent double-spend tests;
- command rollback, restart and Durable Object eviction tests;
- request/response/OpenAPI contract enforcement;
- scoped API-key permissions and permission-route drift checks;
- request-bound named-human actor assertions;
- provider capability/finality conformance;
- durable provider reconciliation;
- encrypted provider/webhook payloads at rest;
- signed provider-originated settlement evidence;
- webhook egress restrictions;
- tracked-secret scanning;
- production dependency advisory checks;
- Foundry unit, fuzz and invariant tests;
- container vulnerability scanning;
- backup/restore and migration recovery proof;
- disposable load and deterministic chaos tests.

## Authentication boundaries

### Tenant API keys

Tenant API keys are high-entropy machine credentials stored as SHA-256 digests. Plaintext is shown only at issuance. Secondary keys can be scoped by resource-domain read/write permissions, and restricted credentials cannot mint broader child authority.

### Named human actors

Institutions can place OIDC/SAML/passkey authentication at their session gateway or BFF and attach short-lived Blueballs actor assertions to backend API requests. The assertion is HMAC-signed and bound to:

- authenticated machine credential;
- method and route;
- canonical query and JSON body;
- named subject;
- assurance level;
- timestamp.

Partial, forged, stale or request-replayed assertions are rejected.

### Operator credential

Operator endpoints use a separate deployment-owned credential configured as a SHA-256 digest in `OPERATOR_API_KEY_HASH`. Comparison is constant-time.

### Provider inbound settlement

`POST /internal/provider/events` can create customer balance, so it requires two independent controls:

1. the private route's operator credential;
2. a fresh HMAC-SHA256 event signature using `BANK_PROVIDER_INBOUND_SECRET`.

Durable `event_id` and provider settlement-reference identities prevent replay and double-crediting.

## Financial and provider safety

- Local financial state, ledger, events/outboxes, idempotency and audit evidence commit together.
- Provider work is durably recorded before external submission.
- The provider job ID is reused as the external idempotency identity across retry/reconciliation attempts.
- Timeout, crash-after-submission, lease expiry, redirects and contradictory provider evidence become explicit reconciliation states.
- HTTP transport evidence cannot override business finality.
- Money-moving success requires capability-specific final evidence.
- Automatic refund occurs only when the provider reports an explicitly safe funds state.
- Provider-returned PAN, CVV/CVC and PIN are excluded from canonical card persistence.
- Receiving coordinates, card identifiers and custody addresses activate from provider evidence rather than generated production state.

## Data protection

Provider jobs can contain identity, account, card and custody metadata. Blueballs seals durable provider payloads with AES-256-GCM before persistence. Ciphertext carries a key ID so deployments can rotate active keys while retaining the keys required to finish existing durable work.

Webhook signing secrets use the same envelope mechanism before target or delivery-job persistence. Public responses never expose the stored secret envelope.

Deployment storage, snapshots and logs can additionally use the institution's infrastructure encryption and retention policy.

Never commit:

- private keys or seed phrases;
- production API credentials;
- provider gateway, inbound-HMAC or encryption keys;
- production signing keys;
- personally identifiable customer data;
- commercial provider credentials;
- live databases or backups.

## Network boundaries

Webhook delivery is opt-in, HTTPS-only, exact-host allowlisted, redirect-free and concurrency-bounded. Provider gateway URLs are HTTPS outside explicit loopback development and redirects are not followed.

Production FX execution is loaded through the institution's runtime adapter, which keeps venue/provider credentials and commercial assumptions outside the canonical FX kernel.

## Release security profile

```bash
pnpm security:release
pnpm security:container
pnpm sbom
pnpm verify:release
```

The full release profile ties security evidence to the exact commit and lockfile and includes banking/FX/Worker tests, Foundry fuzz/invariants, dependency inventory, restart/chaos, load proof and reference-container scanning.

External application, smart-contract or penetration reviews can consume the same deterministic release artifacts and public contracts without changing the Blueballs release authority.

See [`PRODUCTION-HARDENING.md`](PRODUCTION-HARDENING.md), [`docs/SECURITY-VERIFICATION.md`](docs/SECURITY-VERIFICATION.md), [`docs/PROVIDER-CONFORMANCE.md`](docs/PROVIDER-CONFORMANCE.md), [`spec/fx/ADAPTERS.md`](spec/fx/ADAPTERS.md) and [`docs/PRODUCTION-OPERATIONS.md`](docs/PRODUCTION-OPERATIONS.md).
