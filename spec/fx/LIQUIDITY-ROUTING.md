# Blueballs FX — Executable Liquidity Routing

Status: FX-4 engineering contract

## Purpose

The liquidity router selects the cheapest safe **executable** combination of liquidity that has already passed institutional policy.

It does not create liquidity, infer balances, or prefer a source category for ideological reasons.

## Eligible source classes

- `PRIVATE_MARKET`
- `ISSUER`
- `INSTITUTIONAL_LP`
- `NEOBANK`
- `BANK_TREASURY`
- `BANK_PRINCIPAL`

A deployment may enable or disable any class. A source without a valid policy authorization is not routable liquidity.

## Executable slice

A source exposes one or more firm executable slices:

- unique slice ID;
- source ID and source class;
- input asset and output asset;
- maximum output capacity;
- exact rational input/output price for that slice;
- expiry;
- policy authorization ID / snapshot hash;
- source-specific opaque reservation payload.

Slices are compared by exact rational arithmetic, never floating point.

## Exact-output planning

For an exact-output request, the planner:

1. removes expired, wrong-pair, zero-capacity, or unauthorised slices;
2. sorts by lowest executable input per output;
3. fills the requested output greedily from cheapest to most expensive;
4. preserves deterministic tie-breaking by source ID then slice ID;
5. fails with `NO_LIQUIDITY` if aggregate executable capacity is insufficient.

The planner is pure. It does not mutate provider state.

## Reservation coordinator

A route becomes quotable only after every selected source confirms a reservation.

Reservation is compensating, not magically atomic across independent off-chain providers:

1. reserve selected slices in deterministic order;
2. if any reservation fails, release every earlier reservation;
3. return no executable quote unless all reservations succeeded;
4. record the exact provider reservation handles used for later submission/release/reconciliation.

For the local Blueballs private market and principal risk book, database transactions provide their local concurrency guarantees. External providers must implement equivalent idempotent reserve/release semantics.

## Invariants

- unauthorized liquidity is never planned;
- the route never exceeds a slice's capacity;
- a route never claims more total output than it reserved;
- planning uses exact price ordering;
- failed reservation of any leg releases all earlier legs;
- retries are idempotent at the source-adapter boundary;
- route provenance identifies every contributing source class and reservation handle;
- no public response needs to expose maker identity or private signed-order payloads.

## Non-goals

This module does not perform KYC/KYB, calculate provider prices, sign taker intents, broadcast transactions, or prove fiat settlement. Those belong to policy, pricing, execution, and fiat-settlement layers respectively.
