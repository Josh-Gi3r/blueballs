# Blueballs FX — Economic Simulator

Status: FX-8 engineering specification.

## Purpose

Contract tests prove that code respects its invariants. The simulator tests whether the market design behaves sensibly when liquidity, flow and settlement conditions become hostile.

It is diagnostic engineering infrastructure, not a polished visual product.

## What it must measure

- order fill rate;
- requested vs filled volume;
- route composition by liquidity source type;
- effective input/output cost;
- bank-principal exposure and peak exposure;
- risk-limit rejections;
- no-liquidity rejections;
- settlement failures;
- source outage effects;
- reference-price outage effects;
- recovery after adverse events.

## Required source classes

The simulator uses the same source taxonomy as `@blueballs/fx-liquidity`:

- `PRIVATE_MARKET`
- `ISSUER`
- `INSTITUTIONAL_LP`
- `NEOBANK`
- `BANK_TREASURY`
- `BANK_PRINCIPAL`

It must route through the real exact-output liquidity planner rather than maintaining a second hidden routing algorithm.

## Principal exposure

For a normalized corridor `A/B`:

- customer buys B: principal B exposure decreases;
- customer sells B: principal B exposure increases.

For every accepted principal leg:

```text
abs(settled simulation exposure) <= configured hard limit
```

This is a simulator invariant, not a metric.

Principal capacity available to the next order is calculated from the remaining distance to both sides of the hard limit. The simulator may not fill an order by exceeding the limit and then reporting the breach afterward.

## Reference-price failure

When trustworthy reference pricing is unavailable, `BANK_PRINCIPAL` is removed from executable sources. Other already-firm authorized sources may remain executable.

The simulator must not synthesize a bank price from stale data.

## Settlement failure

A simulated settlement failure behaves like a reverted/uncommitted route:

- source capacity reserved by that attempted route is restored;
- principal exposure from that attempted route is restored;
- filled volume is not counted;
- settlement-failure metric increments.

This distinguishes economic routing from final settlement success.

## Scenario events

MVP events:

- `SOURCE_OFFLINE`
- `SOURCE_ONLINE`
- `REFERENCE_UNAVAILABLE`
- `REFERENCE_AVAILABLE`
- `CANCELLATION_STORM` (reduces private-market capacity)
- `CANCELLATION_RECOVERY`
- `CHAIN_CONGESTION` (raises settlement-failure probability)
- `CHAIN_RECOVERY`
- `PRICE_SHOCK` (records a new normalized reference index)

## Baseline scenarios

1. Balanced flow with ample institutional liquidity.
2. 90% one-way flow.
3. Institutional LP disappears mid-run.
4. Issuer disappears mid-run.
5. Bank principal approaches its hard limit.
6. Reference sources become unavailable.
7. 5% market shock.
8. Cancellation storm removes most private-market depth.
9. Chain congestion introduces settlement reverts.
10. Recovery after the adverse condition clears.

Fiat-proof replay and evidence correctness are tested in `@blueballs/fx-fiat`; later simulator iterations may add asynchronous fiat latency distributions.

## Determinism

Every scenario is seeded. A given seed and configuration must produce byte-for-byte equivalent metrics. This allows economic behavior to become a regression-tested part of the project.
