# Blueballs FX — Canonical Schemas

These are logical schemas. Solidity/TypeScript encodings must preserve their semantics exactly. Changes to signed financial fields after implementation begins are architecture changes, not ordinary refactors.

## Domain separation

All EIP-712 signed financial messages must be bound to:
- protocol name/version
- chain ID
- verifying contract

This prevents signatures from being replayed across deployments/chains/contracts.

## MakerOrder

A maker authorises sale of one token for another under explicit bounds.

```text
MakerOrder {
  maker: address
  sellToken: address
  buyToken: address
  sellAmount: uint256
  buyAmount: uint256
  recipient: address
  validAfter: uint64
  validUntil: uint64
  epoch: uint64
  salt: bytes32
}
```

Semantics:
- `sellAmount` and `buyAmount` define the maker's signed limit price.
- Partial fills preserve the same price ratio unless the order type explicitly says otherwise in a future schema version.
- `recipient` receives the bought asset; normally the maker but explicit to support segregated settlement accounts.
- `epoch` is checked against the maker's on-chain invalidation floor.
- `salt` makes otherwise identical orders unique.

Order hash is the canonical EIP-712 digest.

## TakerIntent

A taker authorises a bounded conversion, not a specific list of counterparties.

```text
TakerIntent {
  taker: address
  inputToken: address
  outputToken: address
  maxInput: uint256
  minOutput: uint256
  recipient: address
  deadline: uint64
  nonce: uint256
  policyAuthorizationHash: bytes32
}
```

Semantics:
- execution may use one or multiple eligible makers
- total taker debit must be `<= maxInput`
- total output delivered must be `>= minOutput`
- output must go to `recipient`
- nonce is one-time consumable
- `policyAuthorizationHash` binds execution to the institution-approved transaction context where the deployment enables policy attestation enforcement

## Fill

A route contains one or more proposed maker fills.

```text
Fill {
  makerOrder: MakerOrder
  makerSignature: bytes
  makerSellAmount: uint256
  takerPayAmount: uint256
}
```

The settlement engine independently verifies:
- maker signature
- order validity
- cancellation/epoch
- price ratio
- remaining fill capacity
- collateral

## AtomicRoute

Logical coordinator payload:

```text
AtomicRoute {
  takerIntent: TakerIntent
  takerSignature: bytes
  fills: Fill[]
}
```

The router computes aggregate input/output from actual validated fills and enforces the taker's signed bounds.

## PolicyAuthorization

Institution-level policy approval for a transaction/route domain.

```text
PolicyAuthorization {
  institution: bytes32
  subject: bytes32
  inputAsset: bytes32
  outputAsset: bytes32
  maxInput: uint256
  maxOutputOrZero: uint256
  allowedLiquidityClasses: uint256
  quoteId: bytes32
  validUntil: uint64
  nonce: uint256
}
```

Notes:
- this object is intentionally provider-neutral
- exact on-chain enforcement mode is configurable by deployment
- the canonical Blueballs flow must always evaluate policy before matching even when a deployment does not require an on-chain policy signature
- identities are opaque references; PII is never included in public signed/on-chain payloads

## FiatSettlementAttestation

Normalized evidence that an off-chain fiat settlement event occurred.

```text
FiatSettlementAttestation {
  intentHash: bytes32
  currency: bytes3
  amountMinor: uint256
  rail: bytes32
  payerRef: bytes32
  payeeRef: bytes32
  paymentId: bytes32
  settledAt: uint64
  validUntil: uint64
  verifier: address
  metadataHash: bytes32
}
```

Semantics:
- `paymentId`/derived nullifier is one-time consumable
- attestation is bound to the intended transaction
- amount is minor units for the specified fiat currency
- payer/payee refs are privacy-preserving canonical references, not raw bank account/identity data
- `metadataHash` can bind additional off-chain evidence without publishing it

## Quote

Off-chain canonical object returned to an integrator.

```text
Quote {
  id
  institutionId
  customerId
  fromAsset
  toAsset
  inputAmount
  expectedOutput
  minOutput
  maxInput
  referencePrice
  executablePrice
  spreadBps
  expiresAt
  settlementMode
  liquiditySummary[]
  routeId
  policyDecisionId
  priceProvenance[]
}
```

A quote is not itself financial authority unless separately signed according to the execution model.

## LiquiditySource

Provider-neutral representation used by pricing/routing.

```text
LiquiditySource {
  id
  participantId
  class
  inputAsset
  outputAsset
  capacity
  minTicket
  maxTicket
  price
  settlementMode
  validUntil
  jurisdictionTags[]
  credentialRefs[]
  riskMetadata
}
```

Initial `class` values:
- `NATURAL_FLOW`
- `CUSTOMER_MAKER`
- `PROFESSIONAL_LP`
- `ISSUER`
- `INSTITUTION`
- `TREASURY`
- `PRINCIPAL`
- `FIAT_PROVIDER`

## SettlementEdge

```text
SettlementEdge {
  type
  fromAsset
  toAsset
  providerId
  inputAmount
  outputAmount
  cost
  expectedTime
  finalityClass
  evidenceRequirement
}
```

Initial `type` values:
- `TOKEN_SWAP`
- `ISSUER_MINT`
- `ISSUER_REDEEM`
- `VERIFIED_FIAT_PAYMENT`
- `BANK_RAIL`
- `INTERNAL_LEDGER`

## Versioning rule

Never reinterpret the semantics of an existing signed type in place. A material schema change requires a new type/domain/protocol version so old signatures cannot be silently interpreted under new rules.
