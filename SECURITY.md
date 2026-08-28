# Security Policy

Blueballs is financial infrastructure software. Please treat suspected vulnerabilities as private until maintainers have assessed and fixed them.

## Supported versions

Security fixes land on `main` and ship in the next tagged release. `main` is the supported line; older snapshots and feature branches are not.

## Reporting a vulnerability

Use GitHub's **Report a vulnerability** / private security advisory interface for this repository.

Please include:

- affected commit or release;
- affected package, contract or endpoint;
- impact and prerequisites;
- minimal reproduction;
- whether funds, authorisations, policy, reservations or reconciliation can be affected;
- suggested mitigation if known.

Do not open a public issue containing exploit details, secrets, private keys, credentials or customer information.

## Response process

Maintainers will:

1. acknowledge the report;
2. reproduce and classify the issue;
3. freeze affected release activity where necessary;
4. create a private fix and regression test;
5. rerun the complete release gate;
6. publish an advisory and patched release when disclosure is safe.

A security report takes priority over feature work.

## Security engineering

The FX implementation includes checks that run on a fresh clone:

- unit and integration tests;
- fuzz and invariant tests for the Solidity kernel;
- controlled Anvil JSON-RPC execution proof;
- policy, risk, reservation and reconciliation tests;
- deterministic economic failure scenarios;
- Docker and production-build gates.

These are engineering controls. An independent external audit is commissioned by the institution deploying the software, alongside the rest of `spec/fx/PRODUCTION-CHECKLIST.md`.

## Production requirements

Before production use, a deploying institution must independently address:

- external smart-contract and application security review;
- production key custody and signer policy;
- real identity, compliance and sanctions providers;
- provider authentication and request signing;
- database high availability, backup and disaster recovery;
- transaction monitoring and reconciliation operations;
- incident response and customer support;
- jurisdiction-specific regulatory and operational obligations;
- deployment-specific penetration testing;
- dependency, container and infrastructure scanning.

Read `spec/fx/THREAT-MODEL.md`, `spec/fx/PRODUCTION-CHECKLIST.md` and `packages/fx-contracts/DEPLOYMENT.md` before deployment.

## Secrets

Never commit:

- private keys or seed phrases;
- production API credentials;
- production signing keys;
- personally identifiable customer data;
- commercial provider credentials;
- live database files.

The browser keeps the reference sandbox key in tab-scoped `sessionStorage`; the
API expires public keys after 24 hours by default. Deployments may shorten the
lifetime but cannot configure public keys beyond seven days.

Builder Agent requests are source- and tenant-rate-limited at the Cloudflare
edge, carry persistent per-tenant and account-wide daily request ceilings plus
a completion-token ceiling, and can be disabled globally with
`BUILDER_AGENT_ENABLED=false`. Operators can lower the account-wide ceiling with
`BUILDER_GLOBAL_DAILY_REQUEST_LIMIT`.

## Shared-host network boundary

The hosted reference sandbox does not deliver outbound webhooks. This is an
intentional SSRF and data-egress boundary, not an integration guarantee.
Self-hosted delivery is opt-in, HTTPS-only, exact-host allowlisted, redirect-free
and concurrency bounded. Deployments that require broader egress must put that
policy in infrastructure they control and threat-model DNS, proxies and private
address reachability independently.
