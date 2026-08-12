# Blueballs API standards

This document defines the repository-wide API design rules. `spec/conventions.md` remains the detailed banking v2 contract; this document establishes the cross-service rules that new APIs must follow.

## Contract first

Externally supported behaviour must be represented in a machine-readable contract before or with implementation. OpenAPI documents are version-controlled and reviewed as public interfaces. UI code is never the source of API truth.

## Compatibility

- Additive, optional response fields are normally backwards compatible.
- Removing or renaming fields, changing types, narrowing accepted values, changing state semantics, or changing side effects is breaking.
- Breaking changes require a version boundary and migration/deprecation documentation.
- Implementations must not silently reinterpret an existing field.

## Money

Money is represented as a decimal string and an explicit currency/asset identifier. IEEE-754 floating point must not be used for ledger, settlement, reservation or executable pricing arithmetic.

## Time

External timestamps use RFC 3339 with an explicit offset. Expiry and timeout semantics state which clock is authoritative.

## Idempotency

Every externally callable mutation that can create financial or durable state must support an idempotency key. Replaying the same key with the same canonical request returns the original outcome; reusing the key with materially different parameters is a conflict. Idempotency records must outlive ordinary network retry windows.

## Errors

Errors are structured, stable and machine-actionable. Prefer RFC 9457 Problem Details for HTTP APIs. A response includes a stable error type/code, HTTP status, human-readable detail and request/correlation identifier. Provider failures are not misreported as successful execution.

## Request identity and observability

Every request has a correlation/request ID propagated through downstream adapters and included in errors and relevant events. Secrets and sensitive customer payloads must not be required to diagnose ordinary failures.

## Pagination

Mutable collections use opaque cursor pagination. Ordering is deterministic and documented.

## State machines

Financial lifecycle state is explicit. Submission, confirmation and final settlement are different concepts. Terminal states are documented. Invalid transitions fail rather than being coerced. Aggregate status derived from legs or child operations must have one canonical derivation rule.

## Webhooks and events

Events have stable identifiers, type, creation timestamp, API version and full resource identity. Delivery is at-least-once unless explicitly specified otherwise; consumers must be able to deduplicate. Replay is observable.

## Authentication and authorisation

Authentication proves caller identity; authorisation/policy determines allowed actions. The two must remain separable. Privileged actions require explicit scope/capability checks rather than UI assumptions.

## Adapters

Public resource contracts are provider-independent. Provider-specific behaviour is expressed through declared capabilities and metadata rather than leaking provider names or response shapes into core APIs.

## Failure semantics

Financial APIs fail closed. An unavailable execution adapter, unknown settlement state or ambiguous provider response must never be converted into invented success, fabricated transaction identifiers or inferred finality.

## Review gate

A change to money representation, idempotency, errors, state transitions, auth/policy, settlement finality, adapter contracts or compatibility rules requires an RFC and corresponding contract/invariant tests.
