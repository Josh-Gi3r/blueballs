# Known Limitations

This file is the repository-wide deployment boundary. The detailed FX list is
maintained in [`spec/fx/KNOWN-LIMITATIONS.md`](spec/fx/KNOWN-LIMITATIONS.md).

## Product and regulatory boundary

- Blueballs is reference software, not a licensed bank, regulated entity,
  sponsor relationship, custody service, insured account or compliance
  programme.
- The website is a product demonstrator. Its banking and FX screens are demos,
  simulations or research surfaces, not end-user banking applications.
- A deployer must supply jurisdiction-specific licensing, legal, compliance,
  consumer-protection, support and operational controls.

## Provider boundary

- Dakota and Bridge are source-cited capability descriptors with no relationship
  claimed and no HTTP integration in this repository.
- Other provider listings are research links unless a separately documented and
  tested adapter says otherwise.
- Real identity, sanctions, banking rails, card issuing, custody, liquidity,
  payment verification, execution and reconciliation adapters are deployment
  responsibilities.

## Runtime boundary

- Node uses SQLite and Cloudflare uses Durable Object SQLite. Neither reference
  topology claims clustered multi-region database availability.
- The supplied Docker Compose stack is for evaluation; banking persistence,
  backups, secret management, monitoring and HA require deployment work.
- The shared hosted sandbox disables outbound webhook delivery. Self-hosted
  delivery is opt-in and deliberately restricted.
- Hosted reference data is disposable. There is no supported migration from
  pre-tenant sandbox rows by matching email addresses.

## Banking and API boundary

- The 180-operation API is a reference implementation. Routes, access classes,
  request contracts and key product journeys are tested, but external bank/rail
  semantics are not simulated as production integrations.
- Rate limiting is process/runtime scoped and is not a substitute for an edge
  abuse platform, fraud engine or institution-grade identity controls.
- The repository does not ship consumer iOS or Android apps.

## Sandbox Builder boundary

- The builder provisions tenant-isolated reference data, not a regulated bank,
  a production environment or deployable consumer application.
- Blueprint generation is currently deterministic and structured. It does not
  call an AI provider, execute generated code or store a model credential.
- The Launch stage does not connect sponsor banks, identity vendors, card
  processors, wallets, production payment rails or compliance systems.
- The Cloudflare reference keeps tenant ownership in Durable Object SQLite but
  does not claim database-per-customer, Workers for Platforms dispatch,
  jurisdictional data residency or institution-grade multi-region failover.

## FX and contract boundary

- The default FX runtime has no execution adapter and fails closed with
  `EXECUTION_UNAVAILABLE`.
- Fiat payment and redemption edges retain external finality; the reference BRL
  to EUR path is mixed-finality, not one atomic transaction.
- Solidity unit, fuzz, invariant and controlled-Anvil results are internal
  engineering evidence, not an independent audit or mainnet proof.
- Reference liquidity and scenarios are deterministic test fixtures, not live
  market depth or executable provider quotes.

## Release evidence boundary

- `pnpm verify` validates the repository, including Compose configuration, but an
  actual Docker image build still requires a running Docker daemon.
- Screenshots demonstrate rendered pages at a named commit; they do not prove
  external integration or runtime safety.
- Until a tagged release is published, `main` is the only supported development
  line and no semantic-version support promise is made.

Production users need independent application and smart-contract reviews,
penetration testing, key-management design, backup/recovery exercises and
deployment-specific threat modelling. See [`SECURITY.md`](SECURITY.md).
