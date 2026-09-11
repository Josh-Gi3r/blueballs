# Banking scale-out model

Blueballs deliberately chooses correctness before horizontal write concurrency.
The current banking runtime has one serialized unit-of-work queue around a
SQLite-backed mutable storage view. That is a valid single-writer model, but it
must not be scaled by starting multiple unsynchronised writers against the same
banking state.

This document defines the supported scale-out direction for production
implementations. It is an architecture contract, not permission to bypass the
transaction, ledger, idempotency, audit or provider-outbox invariants.

## Invariants that do not change

Every shard must preserve the existing command boundary:

```text
authentication / authorization
  -> domain state
  -> ledger postings
  -> durable events / outboxes
  -> idempotency result
  -> audit correlation
  -> commit
```

A tenant cannot observe another tenant's staged state. A customer-money command
has exactly one authoritative writer. Provider ambiguity remains reconciliation
state rather than being hidden by retries. Sharding does not introduce
floating-point money or cross-database balance derivation.

## Recommended unit of scale

The preferred production unit is an institution/tenant shard. A request is
resolved to a tenant before it reaches mutable banking state, then routed to one
authoritative shard for that tenant.

For Durable Objects, the target shape is one named banking object per tenant (or
per deliberately grouped tenant shard), rather than one global object for all
institutions. For Node deployments, the equivalent is a single-writer process or
writer lease per SQLite/PostgreSQL shard. Multiple stateless HTTP processes may
sit in front, but they must resolve each command to exactly one writer.

## Principal directory

Tenant routing cannot depend on opening every banking database to discover an
API key. Scale-out therefore separates a small principal/control-plane index from
tenant financial state.

The directory stores only routing/authentication metadata such as:

- API-key digest or external IAM subject;
- tenant ID;
- shard ID / Durable Object name;
- credential status and expiry;
- permission version.

It does not own balances, customer resources, ledger postings or provider
settlement state. Credential creation/revocation updates the directory and the
tenant shard through an idempotent control-plane command.

## Tenant request routing

1. Authenticate the credential against the principal directory.
2. Resolve `tenant_id` and authoritative `shard_id`.
3. Forward the original request plus trusted authenticated context to that shard.
4. Re-authorize the operation inside the shard against the tenant credential
   record/version.
5. Execute the normal serialized financial unit of work.

A caller-supplied tenant ID is never trusted for routing.

Provider-originated events already carry canonical tenant identity. The provider
gateway must resolve that tenant through the same routing directory before
forwarding the signed event to its authoritative shard.

## Inter-tenant money movement

Blueballs must not create a fake distributed SQL transaction between tenant
shards. Cross-tenant value movement is an orchestrated settlement workflow:

1. source shard atomically reserves/debits value into a clearing position and
   writes an outbox operation;
2. a settlement coordinator/provider moves or proves the external/internal
   settlement leg using a stable operation ID;
3. destination shard idempotently credits only from final settlement evidence;
4. ambiguous coordinator/provider state remains in reconciliation;
5. safe compensation is permitted only when the funds-state contract proves it
   is safe.

This is the same finality principle used by the provider gateway. A timeout is
not a reason to create money on both shards or refund money speculatively.

## Read scaling

Read replicas, caches and analytical stores are allowed only for data that can be
stale without changing financial decisions. Balance checks, spend controls,
reservation availability and mutation authorization must read the authoritative
shard inside the command boundary.

Cross-tenant dashboards should consume an event/materialized-view pipeline. They
must not join tenant financial databases in the write path.

## Optimistic concurrency

Optimistic concurrency is a future alternative to the current serialized mutable
cache, not an additive shortcut. Before enabling concurrent writers the storage
layer must provide:

- immutable/copy-on-write request views or database-native MVCC;
- explicit row/version predicates for every mutable financial aggregate;
- atomic compare-and-swap of business state, ledger, event/outbox and idempotency
  evidence;
- deterministic retry of conflicts without duplicating external side effects;
- concurrency tests that include balance floors, policy limits and provider jobs.

Until those conditions are met, a shard remains single-writer.

## Moving an existing tenant between shards

A live migration follows a controlled cutover:

1. place the tenant in migration/drain mode and stop new mutation commands;
2. wait for in-flight local transactions to finish;
3. snapshot the tenant's complete domain state, ledger, events, idempotency,
   audits and durable outboxes;
4. restore to the target shard;
5. recompute ledger-derived balances and compare counts/checksums;
6. verify migration version and all pending provider/webhook operation IDs;
7. atomically switch the principal-directory routing pointer;
8. resume traffic and run read/write probes;
9. retain the source snapshot until the recovery window expires.

Do not dual-write source and destination banking stores during migration. If
verification fails before the routing pointer changes, discard the target. If it
fails after cutover, stop mutation traffic before deciding whether a pointer
rollback is safe.

## Capacity signals

Shard planning should monitor at least:

- command queue latency and p95/p99 request latency;
- SQLite/DO transaction duration;
- ledger posting rate;
- outbox/reconciliation backlog;
- storage size and migration duration;
- tenant hot-spot concentration;
- failed/retried idempotent commands.

Scale because these signals require it, not by adding concurrent writers to a
healthy single-writer shard.
