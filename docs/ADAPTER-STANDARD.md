# Adapter and capability standard

Blueballs treats external providers as replaceable implementations of stable capabilities. Provider configuration must not become the public product contract.

## Capability descriptor

Every production-facing adapter should expose metadata equivalent to:

```yaml
id: example-provider-cards
capability: card.issuing
maturity: experimental
mode: sandbox
production_ready: false
jurisdictions: []
currencies: []
features: []
limitations: []
```

## Maturity

- `reference`: deterministic/local implementation for development or demonstration; not a live provider.
- `experimental`: real integration surface that has not passed the production evidence gate.
- `production`: integration has documented credentials/configuration, conformance tests, failure mapping, observability and operational runbook.
- `deprecated`: supported only for migration and has a documented removal boundary.

`production_ready` is evidence-based and must never be inferred from the adapter having real network calls.

## Required adapter behaviour

An adapter must declare capabilities rather than relying on caller knowledge. Unsupported features return a typed capability error. Adapters map provider-specific states into canonical Blueballs states without inventing finality.

A financial adapter must document:

- authentication/credential model;
- supported operations and limits;
- idempotency/retry behaviour;
- timeout behaviour;
- provider error mapping;
- webhook/event verification;
- reconciliation strategy;
- sandbox/test strategy;
- observability and redaction rules;
- outage and degraded-mode behaviour;
- production evidence and known limitations.

## Conformance

Each capability family should own a provider-independent conformance suite. The same suite runs against reference and provider adapters. Provider-specific tests may supplement but never replace conformance tests.

## Resolution

Capability resolution may consider policy, jurisdiction, asset/currency, feature support and operational availability. Resolution must be deterministic for identical inputs and observable to operators. Selection policy must not be hidden in UI code.

## Security boundary

Credentials belong to deployment configuration/secret stores and are never committed. Adapters receive only the credentials/scopes required for their capability. Logs and exceptions must redact credentials and sensitive provider payloads.
