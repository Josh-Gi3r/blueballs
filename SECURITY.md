# Security Policy

Blueballs is financial infrastructure software. Please treat suspected
vulnerabilities as private until maintainers have assessed and fixed them.

## Supported versions

Security fixes land on `main` and ship in the next tagged release. `main` is the
supported development line; a production release is supported only when its exact
commit retains the release evidence required by `PRODUCTION-HARDENING.md`.

## Reporting a vulnerability

Use GitHub's **Report a vulnerability** / private security advisory interface for
this repository.

Please include:

- affected commit or release;
- affected package, contract or endpoint;
- impact and prerequisites;
- minimal reproduction;
- whether funds, authorisations, policy, reservations, reconciliation, custody,
  provider callbacks or tenant isolation can be affected;
- suggested mitigation if known.

Do not open a public issue containing exploit details, secrets, private keys,
credentials or customer information.

## Response process

Maintainers will:

1. acknowledge the report;
2. reproduce and classify the issue;
3. freeze affected release activity where necessary;
4. create a private fix and regression test;
5. rerun the complete release/security gate;
6. publish an advisory and patched release when disclosure is safe.

A security report takes priority over feature work.

## Security engineering in the repository

Blueballs now treats security controls as release code rather than deployment
notes. The production gate includes:

- exact-money, tenant-isolation, idempotency and financial rollback tests;
- concurrent double-spend and restart/eviction tests;
- request/response/OpenAPI contract enforcement;
- provider finality/reconciliation conformance;
- encrypted production provider and webhook signing payloads at rest;
- signed provider-originated settlement facts with replay protection;
- scoped API-key permissions and permission-route drift checks;
- high-signal tracked-secret scanning;
- high/critical production dependency advisory checks;
- CodeQL JavaScript/TypeScript analysis;
- Foundry unit, fuzz and invariant tests for Solidity;
- Cloudflare Worker/Durable Object runtime tests;
- container build and Compose validation.

These controls reduce preventable defects; they do not replace an independent
security assessment.

## Authentication boundaries

### Tenant API keys

Tenant API keys are machine credentials. Secondary keys can be restricted by
resource-domain read/write permissions, and a restricted key cannot mint a child
credential with greater permissions than it holds. Keys are stored as SHA-256
digests of high-entropy generated secrets; plaintext is shown only at issuance.

Production human-facing dashboards should terminate user authentication at the
deployment's identity layer/BFF and use short-lived, least-privilege machine
credentials or another deployment-approved credential exchange. Blueballs does
not ship a password database or pretend that a generic local login implementation
is appropriate for every regulated institution.

### Operator credential

Operator-class endpoints use a deployment-owned operator credential whose SHA-256
hex digest is configured as `OPERATOR_API_KEY_HASH`. Comparison is constant-time.
Do not reuse this credential for tenant traffic or provider-signature secrets.

### Provider inbound settlement

`POST /internal/provider/events` can create customer balance and therefore has two
independent controls:

1. the private route requires the operator credential; and
2. the canonical event must carry a fresh HMAC-SHA256 authentication envelope
   signed with `BANK_PROVIDER_INBOUND_SECRET`.

The durable provider `event_id` is the financial replay identity. Reusing an ID
with different evidence returns `409` and posts no money. See
`docs/PROVIDER-INBOUND.md`.

## Financial/provider safety boundaries

- Local domain state, ledger postings, durable events/outboxes, idempotency and
  successful audit evidence commit as one SQLite unit of work.
- External side effects are never assumed to roll back with local state.
- Provider submission uses a durable operation ID as the external idempotency key.
- Network timeout, process death after submission, lease expiry and contradictory
  provider evidence become explicit reconciliation states.
- A non-2xx provider HTTP response cannot declare a financial operation
  successful merely because its body says `outcome: succeeded`.
- Money-moving provider success requires canonical final funds evidence.
- Automatic refunds occur only for explicit safe funds states such as
  `not_sent`, `rejected_before_submission` or `returned`.
- Provider-returned PAN, CVV/CVC and PIN are never persisted in canonical card
  state.
- Production accounts/cards/wallets do not expose deterministic sandbox
  instruments while real provider provisioning is pending.

## Data protection

Production provider jobs can contain identity, account, card and custody metadata.
They are sealed with AES-256-GCM before durable persistence. The ciphertext stores
a key ID so deployments can rotate keys while retaining old decryption keys until
no queued/reconciliation job references them.

Production webhook signing secrets use the same secure-envelope mechanism before
the webhook target or delivery job is persisted. Public webhook responses never
return the stored envelope.

Field-level encryption does **not** replace infrastructure encryption. Database
volumes, snapshots, backups, logs and provider-gateway stores must also use the
deployment's encryption/access-control policy.

Never commit:

- private keys or seed phrases;
- production API credentials;
- provider gateway, inbound-HMAC or encryption keys;
- production signing keys;
- personally identifiable customer data;
- commercial provider credentials;
- live database or backup files.

## Shared-host network boundary

The hosted public sandbox should leave outbound webhook delivery disabled.
Self-hosted delivery is opt-in, HTTPS-only, exact-host allowlisted,
redirect-free and concurrency bounded. Deployments requiring broader egress must
put that policy in infrastructure they control and threat-model DNS resolution,
proxies, private-address reachability and exfiltration independently.

Provider gateway URLs are HTTPS-only outside explicit loopback development and
never follow redirects.

## Production operations security

Before a release is certified for production, retain proof for:

- clean-checkout local verification;
- the required hosted Production Gate on the same commit;
- dependency/SAST/secret-scan results;
- exact API/SDK/OpenAPI contract artifacts;
- Foundry fuzz/invariant results;
- container digest and deployment identity;
- current migration version;
- verified backup/restore drill;
- provider/reconciliation operational readiness;
- known external-provider and jurisdictional limitations.

The repository includes verified Node/SQLite snapshot/restore tooling and a DR
runbook, but a deploying institution still owns its actual infrastructure,
replication, off-site backup, IAM, monitoring, incident response and regulatory
record-retention implementation. See `docs/OPERATIONS.md`.

## Independent review required for 1.0 certification

The remaining non-self-certifiable security gate is an independent application
and smart-contract security review, together with deployment-specific penetration
testing. Blueballs must not describe itself as independently audited until that
work has actually been performed and findings have been dispositioned.

Read `spec/fx/THREAT-MODEL.md`, `spec/fx/PRODUCTION-CHECKLIST.md`,
`packages/fx-contracts/DEPLOYMENT.md`, `docs/PROVIDER-CONFORMANCE.md` and
`docs/OPERATIONS.md` before production deployment.
