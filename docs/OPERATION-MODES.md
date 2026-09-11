# Banking operation modes

Blueballs deliberately keeps one executable sandbox/reference API alongside the
production-capable core. The distinction is enforced in code, not inferred from
marketing copy.

The machine-readable source of truth is:

```text
spec/banking/operation-modes.mjs
```

Every entry in `SANDBOX_ONLY_OPERATIONS` is a real documented catalogue operation
that works in sandbox/reference mode and is rejected **before its domain handler**
when `BANK_API_MODE=production`.

`node scripts/check-operation-modes.mjs` fails if that list contains an operation
that is not in the 181-operation catalogue. `apps/api/test/production-mode.test.js`
proves representative reference families fail closed at runtime.

## Why operations are sandbox-only

An operation belongs on the sandbox-only list when executing it in production
would otherwise pretend that an external system, commercial product policy or
sensitive-data control exists when it does not. Current categories include:

- instant signup/funding/KYC decision shortcuts;
- inline onboarding-document binaries used by the sandbox instead of a dedicated
  encrypted object/document store;
- card network authorisation simulation, local-only processor controls and
  disputes;
- savings/credit reference economics whose terms can be configured by the caller;
- reference statement/PDF and fee-schedule fixtures;
- payment-link, mandate and subscription records without a connected production
  collection/direct-debit execution provider;
- the historical banking-runtime FX compatibility workflows; production FX
  execution belongs to the canonical FX runtime/provider boundary;
- Builder and sandbox scenario controls.

Failing closed is intentional. A locally updated row is not a production card
freeze if the processor was never told. A generated URL is not a production
payment link if no collection surface exists. A reference interest calculation
is not a regulated savings product.

## What remains production-capable

The production banking runtime keeps the primitives that Blueballs can execute
without inventing external finality, including:

- production bootstrap and scoped machine credentials;
- tenant/customer and application state;
- API-key authorization and optional signed human actor attribution;
- internal ledger accounts;
- provider-backed receiving details;
- provider-backed KYC/application submission;
- provider-backed card issuance;
- provider-backed bank transfers;
- provider-backed custody wallet provisioning and sends;
- signed provider-originated settled credits/deposits;
- policies, approval chains and organisation controls where they operate on core
  state/provider-backed commands;
- exact ledger/event/audit/idempotency state;
- durable provider/webhook outboxes and reconciliation;
- stateless QR utilities;
- public indicative/reference market/rail metadata where no mutation/finality is
  implied;
- health, readiness and operator metrics.

## Moving an operation to production

Do not remove an operation from `SANDBOX_ONLY_OPERATIONS` merely because a UI
needs it. A production promotion requires:

1. a canonical state/finality contract;
2. any required provider/regulated adapter capability;
3. durable idempotent retry/reconciliation behavior for external side effects;
4. tenant/permission/audit rules;
5. production-specific negative and failure tests;
6. request/response/OpenAPI contract coverage;
7. restart/eviction behavior where money or durable workflow state is involved;
8. documentation that distinguishes Blueballs-owned state from deployment-owned
   regulatory/provider obligations.

This rule prevents the reference sandbox from slowly becoming a production API
by accident.
