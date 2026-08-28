# Blueballs FX — Fiat Settlement Graph

## Principle

Fiat is not made atomic by putting a proof next to it.

A same-chain token route can be atomic because every value movement can succeed or revert inside one transaction. External bank/payment-rail transfers usually cannot be reverted by the Blueballs transaction. They therefore require an explicit asynchronous state machine, evidence, timeouts, dispute/recovery handling, and compensation rules.

Blueballs models fiat as settlement edges with explicit finality semantics rather than pretending every route has identical settlement guarantees.

## Edge types

- `TOKEN_SWAP` — same-chain atomic token exchange.
- `ISSUER_MINT` — verified fiat/issuer balance produces tokenized value.
- `ISSUER_REDEEM` — tokenized value is redeemed for fiat/issuer balance.
- `VERIFIED_FIAT_PAYMENT` — an approved verifier attests that a specified off-chain fiat payment settled.
- `INTERNAL_LEDGER` — authoritative movement inside the deploying institution's own ledger.
- `BANK_RAIL` — external bank transfer with rail-specific settlement/finality state.

Each edge declares:

- source asset/value representation;
- destination asset/value representation;
- provider/participant;
- policy authorization;
- capacity;
- price/cost;
- expected settlement window;
- finality model;
- reservation mechanism;
- proof/verifier type;
- failure and recovery semantics.

## Finality classes

### ATOMIC

All value movement is committed or reverted together on-chain.

Expected use: `TOKEN_SWAP`.

### AUTHORITATIVE_LEDGER

The institution controls the authoritative ledger and can reserve and post both sides under one transaction boundary in its own system.

Expected use: `INTERNAL_LEDGER`.

### ATTESTED_EXTERNAL

An external payment settles outside Blueballs and a permitted verifier attests the result. The external payment itself is not reversible by Blueballs.

Expected use: `VERIFIED_FIAT_PAYMENT`, some issuer mint/redeem flows.

### ASYNC_EXTERNAL

Submission, acceptance and final settlement occur through an external rail over time.

Expected use: `BANK_RAIL` and some issuer flows.

## Fiat settlement intent

A fiat leg must be bound to a unique intent before evidence can satisfy it.

Canonical intent fields:

```text
intentId
routeId
edgeId
payerParticipantId
payeeParticipantId
payerAccountRef
payeeAccountRef
currency
amount
rail
providerId
policyAuthorizationId
createdAt
expiresAt
nonce
```

The canonical intent hash is SHA-256 encoded as bytes32 hex (`0x` + 64 hex characters) for cross-package compatibility.

## Fiat settlement attestation

A verifier may attest only to a specific intent.

Canonical attestation fields:

```text
attestationId
intentHash
verifierId
verifierType
paymentId
currency
amount
payerRefHash
payeeRefHash
settledAt
issuedAt
expiresAt
status
proofRef
```

Raw bank statements, login sessions, PII and payment credentials do not belong in the shared settlement record. Provider-specific adapters may retain them in their own protected systems and expose opaque references.

## Required anti-replay rules

- `paymentId` is globally unique within a verifier namespace.
- one successful payment evidence object may satisfy at most one intent unless a provider explicitly supports partial allocation with its own unique allocation IDs;
- currency and amount must match the intent exactly in the reference implementation;
- intent hash must match;
- verifier must be enabled by policy;
- attestation must be within its validity window;
- an expired or cancelled intent cannot be fulfilled;
- duplicate delivery of the same attestation is idempotent, never a second settlement.

## State machine

```text
CREATED
  -> RESERVED
  -> SUBMITTED
  -> PAYMENT_OBSERVED
  -> VERIFIED
  -> SETTLED
```

Failure paths:

```text
CREATED/RESERVED -> CANCELLED
CREATED/RESERVED -> EXPIRED
SUBMITTED/PAYMENT_OBSERVED/VERIFIED -> FAILED
SUBMITTED/PAYMENT_OBSERVED/VERIFIED -> MANUAL_REVIEW
```

A route may not silently roll a submitted external fiat leg back to `RESERVED`.

## Route semantics

A mixed route is a graph of edge executions, not one giant atomic transaction.

Example:

```text
MYR bank payment
  -> VERIFIED_FIAT_PAYMENT
USDC
  -> TOKEN_SWAP (atomic on-chain)
EURC
  -> ISSUER_REDEEM
EUR bank account
```

The route coordinator must expose the settlement guarantee of every leg and the current state of every leg.

A route can only be marketed as atomic when every value-moving edge belongs to one atomic transaction boundary. Mixed fiat routes must instead be described with their actual settlement/finality model.

## Provider-neutral verifier interface

```text
verify(intent, evidence) ->
  VERIFIED attestation
  PENDING
  REJECTED(reason)
  MANUAL_REVIEW(reason)
```

Potential adapters:

- internal bank ledger verifier;
- signed bank API event;
- open-banking verifier;
- TEE verifier;
- zkTLS verifier;
- stablecoin issuer mint/redeem verifier;
- Peer/ZKP2P-style payment attestation adapter.

No adapter is mandatory to Blueballs core.

## Compliance

A fiat provider/verifier is an FX participant and is subject to the same policy plane as other liquidity/settlement participants.

Before an external fiat edge may be selected:

1. provider is active;
2. required KYB/compliance credentials are valid;
3. corridor/currency/rail is permitted;
4. payer/payee account references are appropriately attributed;
5. ticket and provider risk limits permit the amount;
6. a short-lived policy authorization is issued for the specific settlement action.

## Reference implementation

Build:

1. canonical intent hashing;
2. durable fiat intent store;
3. verifier registry;
4. attestation validation;
5. payment ID replay protection;
6. exact state transitions;
7. internal-ledger verifier reference adapter;
8. generic attested-payment verifier reference adapter;
9. settlement graph primitive;
10. tests for duplicate/replayed/wrong-amount/wrong-currency/wrong-recipient/expired evidence and honest post-submission failures.

Do not yet build provider-specific production integrations or put PII on-chain.
