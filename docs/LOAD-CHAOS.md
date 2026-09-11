# Load, soak and chaos verification

Blueballs correctness tests prove invariants deterministically. Load and chaos
verification asks a different question: do those invariants continue to hold when
requests overlap, processes restart and external dependencies misbehave?

Never run the banking mutation harness against customer production data. Use an
isolated sandbox/staging tenant and a disposable funded account.

## Deterministic failure suite

Run:

```bash
pnpm stress:chaos
```

This re-exercises the financial restart boundaries, webhook durable outbox,
banking backup/restore, canonical FX suites and Durable Object financial-state
eviction tests.

It complements, rather than replaces, `pnpm verify`.

## Load / soak harness

Prepare a disposable banking tenant/account, then:

```bash
LOAD_MODE=both \
LOAD_DURATION_SECONDS=300 \
LOAD_CONCURRENCY=25 \
LOAD_MAX_ERROR_RATE=0 \
BANK_BASE_URL=http://127.0.0.1:5290 \
BANK_API_KEY=bb_sandbox_... \
BANK_ACCOUNT_ID=acc_... \
BANK_CURRENCY=EUR \
FX_BASE_URL=http://127.0.0.1:8788 \
FX_API_KEY=bb_test_local_fx \
pnpm stress:load
```

`banking` mode sends unique idempotent one-cent `payment.success` sandbox
commands to the supplied account, exercising domain state, exact ledger posting,
events and the command boundary. `fx` mode repeatedly exercises the canonical
reference-trade preview pipeline. `both` alternates the two workloads.

The report includes request count, requests/second, error rate and p50/p95/p99/max
latency. The process exits non-zero if error rate exceeds `LOAD_MAX_ERROR_RATE`.

## Release-candidate profile

A reasonable repository-level RC evidence run is:

1. **5-minute smoke load:** concurrency 25, zero unexpected errors.
2. **30-minute soak:** concurrency based on the intended small-institution
   deployment capacity; no growing provider/webhook/reconciliation backlog.
3. **Concurrent spend test:** existing API stress test must preserve exact balance
   floor with more contenders than available cents.
4. **Restart suite:** restart banking between committed financial commands and
   prove exact state/idempotency after restart.
5. **Durable Object eviction:** evict/reconstruct between account, vault,
   transfer, card-authorisation and wallet financial workflows.
6. **Provider ambiguity:** exercise timeout/non-2xx/lease-expiry cases and prove
   they reconcile rather than duplicate external movement.
7. **FX failure scenarios:** reference outage, LP offline, issuer policy block,
   treasury/principal limits and normal route all retain policy/finality rules.
8. **Recovery:** restore a banking snapshot and verify exact ledger-derived money.

## Acceptance criteria

The load/chaos run is acceptable only when:

- no negative customer balance is produced;
- ledger transactions remain balanced;
- no idempotency key produces a duplicate command side effect;
- no provider job changes from ambiguous/pending to success without valid
  provider finality evidence;
- no cross-tenant row appears;
- reconciliation/webhook queues drain or remain within the declared SLO;
- p95/p99 latency is recorded for the deployment target rather than hidden;
- memory/storage/CPU saturation does not cause silent financial divergence;
- the database remains integrity-check clean after the run.

Throughput is not a production-readiness victory if any financial invariant
weakens under load.

## Capacity interpretation

The current single-runtime banking implementation is intentionally serialized.
Higher concurrency therefore measures queueing and service capacity, not permission
to add concurrent writers. If the target workload exceeds one shard's SLO, scale
by tenant/institution ownership as described in [`SCALING.md`](SCALING.md).

Retain the harness configuration, source commit and result JSON with release
evidence for any release that makes a production-capacity claim.
