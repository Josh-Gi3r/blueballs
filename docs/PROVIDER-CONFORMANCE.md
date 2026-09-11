# Provider conformance

Blueballs production adapters implement the canonical provider boundary declared
in `spec/provider-capabilities.mjs`. Provider-specific SDKs, bank APIs, card
processors, custody systems and KYC vendors sit behind that boundary; they do not
change Blueballs financial state semantics.

## Release rule

A provider integration is compatible only when it passes the same capability
contract as the deterministic adapter in
`apps/api/test/helpers/fake-provider.js` and the conformance suite in
`apps/api/test/provider-conformance.test.js`.

Every declared outbound capability must have all of the following:

1. a production intent that queues a durable provider operation;
2. an outcome handler that maps canonical provider evidence into Blueballs state;
3. a deterministic fake-adapter result that satisfies the finality contract;
4. documentation of input, terminal evidence and ambiguous/reconciliation state;
5. retry-safe provider idempotency using the stable Blueballs `job_id`.

The build gate `scripts/check-provider-capabilities.mjs` fails when the declared
capability set drifts from the intent, outcome, deterministic fixture or provider
documentation surfaces.

## Current outbound capabilities

| Capability | Action | Required finality |
| --- | --- | --- |
| `payments.transfer` | `submit` | `funds_state=settled` |
| `cards.issuing` | `issue` | Provider reference, processor token or valid last4 |
| `accounts.receiving_details` | `issue` | Provider-backed receiving instrument identifier |
| `identity.verification` | `submit` | Canonical approved/declined/withdrawn decision |
| `custody.wallet` | `create` | Provider-backed wallet address |
| `custody.transfer` | `submit` | `funds_state=settled` |

A transport-level 2xx is not finality. Capability-specific evidence is validated
before any result can make canonical financial/resource state terminal.
Contradictory or malformed evidence becomes `ambiguous` and enters
reconciliation.

## Inbound provider facts

Provider-originated settled facts currently support:

- `payments.account_credit_settled`
- `custody.wallet_deposit_settled`

Inbound facts are dual-authenticated:

- the private `/internal/provider/events` route requires the deployment operator
  credential; and
- the event body contains a dedicated HMAC authentication envelope signed with
  `BANK_PROVIDER_INBOUND_SECRET`.

The `authentication` object is:

```json
{
  "timestamp": "1789123456",
  "signature": "v1=<64-hex-hmac-sha256>"
}
```

The signed message is:

```text
<timestamp>.<canonical JSON body excluding authentication>
```

The default accepted clock skew is 300 seconds and can be changed with
`BANK_PROVIDER_INBOUND_MAX_SKEW_SECONDS` (30–3600 seconds). The durable
`event_id` remains the replay/idempotency identity. Authentication metadata is
excluded from the evidence fingerprint so a legitimate retry can carry a fresh
signature without becoming a second credit/deposit.

## Deterministic adapter requirement

The repository fake adapter is deliberately boring. For the same `job_id` and
capability it returns the same canonical final result and performs no network or
external side effect. Its purpose is to prove the Blueballs/provider contract,
not emulate vendor-specific behavior.

A real adapter should add its own vendor contract tests, but may not weaken the
canonical checks. In particular:

- money movement may not claim success without final funds evidence;
- provider 4xx/5xx/network ambiguity may not be translated to success;
- cards may not return PAN/CVV/CVC/PIN into canonical state;
- receiving details may not claim success without a real instrument identifier;
- identity success requires a canonical decision;
- custody wallet success requires a provider-backed address;
- ambiguous submission must reconcile with the same stable `job_id`, not create
  a second instruction.

## Certification evidence

For a production adapter release retain:

- Blueballs commit SHA and provider protocol version;
- conformance-suite result;
- vendor adapter test result;
- configured capability list;
- sandbox/staging evidence for each capability;
- failure/timeout/retry/reconciliation evidence;
- credential and encryption-key rotation proof;
- known provider-specific limits and settlement/finality assumptions.

Provider certification is per adapter/version. Passing one provider's tests does
not certify another provider or a future vendor API version.
