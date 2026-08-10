# Security Policy

Blueballs is financial infrastructure software. Please treat suspected vulnerabilities as private until maintainers have assessed and fixed them.

## Supported versions

The project currently supports only the latest tagged `0.1.x` reference release and the current `main` branch. Older snapshots and feature branches are not supported security releases.

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

No specific response-time SLA is promised during the reference stage.

## Security status

The repository contains internal evidence for the FX reference implementation:

- unit and integration tests;
- fuzz and invariant tests for the Solidity kernel;
- controlled Anvil JSON-RPC execution proof;
- policy, risk, reservation and reconciliation tests;
- deterministic economic failure scenarios;
- Docker and production-build gates.

These are engineering controls, not an independent security audit, regulator approval, production-mainnet proof or guarantee that the software is safe for customer funds.

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

Read `spec/fx/THREAT-MODEL.md`, `spec/fx/KNOWN-LIMITATIONS.md` and `packages/fx-contracts/DEPLOYMENT.md` before deployment.

## Secrets

Never commit:

- private keys or seed phrases;
- production API credentials;
- production signing keys;
- personally identifiable customer data;
- commercial provider credentials;
- live database files.

The browser configuration in the reference website is for a local sandbox key only.
