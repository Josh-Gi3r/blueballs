# Production operations standard

Blueballs core targets production-grade financial correctness. Availability,
regional topology, credential custody and the exact regulated-provider estate are
deployment-owned because they depend on the institution and infrastructure
provider. This document defines the minimum operational contract a deployment
must meet; it is not permission to call an evaluation Compose stack highly
available.

## Service tiers and recovery objectives

A deployment must declare its own approved RPO/RTO. The reference targets below
are the minimum baseline used by the Blueballs release process:

| State | Reference RPO | Reference RTO | Notes |
| --- | ---: | ---: | --- |
| Acknowledged ledger / customer-money commands | **0 data loss target** | <= 30 min | A topology that can lose an acknowledged ledger commit is not acceptable for a production payment core. |
| Provider/webhook outbox and reconciliation state | Same durability as command commit | <= 30 min | These rows are part of the local financial command/finality record. |
| Identity/resource state | Same durability as command commit | <= 30 min | Restore must be consistent with ledger and outbox state. |
| Derived analytics/search materializations | <= 15 min | <= 4 h | May be rebuilt from authoritative events/state. |
| Public static site | <= 24 h | <= 1 h | Does not own financial state. |

The targets are architecture requirements, not a guarantee by this repository.
The operator must choose infrastructure capable of meeting them and prove that
choice with a recovery exercise.

## Non-Durable-Object HA reference

The Node/SQLite banking runtime is a **single-writer shard**. Do not obtain HA by
running several unsynchronised Node writers against copies of the same database.
The reference topology is active/passive:

```text
                    +------------------+
Internet / gateway -> stateless ingress |
                    +---------+--------+
                              |
                       tenant/shard route
                              |
                    +---------v---------+
                    | active bank writer |
                    |  Node + SQLite     |
                    +---------+---------+
                              |
                 synchronous durable volume
                    /                     \
          primary failure domain      replicated standby
                    \                     /
                    +---------+-----------+
                              |
                    fenced passive writer
```

Requirements:

- exactly one writer lease/fencing authority per banking shard;
- storage replication/durability capable of the institution's committed-ledger
  RPO target;
- health/readiness removes an unhealthy writer before promotion;
- promotion cannot occur until the old writer is fenced;
- provider/webhook pumps start only on the authoritative writer;
- deployment secrets are available to the promoted writer without being stored
  in the database image;
- restore/promotion validates schema and database integrity before traffic.

Read replicas or analytical copies may serve non-authoritative reporting. They
must never approve a spend, calculate available balance for a mutation, reserve
FX liquidity or decide provider finality.

See [SCALING.md](SCALING.md) for tenant sharding and the longer-term scale-out
model.

## Durable Object deployment

Cloudflare Durable Objects provide the single-writer ownership model for the
reference Worker runtime. Blueballs still requires the deployment to test:

- object eviction and reconstruction from durable SQLite state;
- alarm recovery for provider and webhook outboxes;
- deployment-version parity across site, banking and FX Workers;
- regional/platform incident procedure and provider-gateway failover;
- export/backup strategy appropriate to the owning Cloudflare account.

Durable Object durability does not remove the need for operational recovery or
provider reconciliation.

## Banking snapshots

The Node runtime includes transactionally consistent snapshot tooling:

```bash
pnpm backup:banking -- --source /var/lib/blueballs/bank.sqlite \
  --destination /backup/blueballs/bank-$(date +%s).sqlite
```

The backup code uses SQLite `VACUUM INTO`, validates `PRAGMA integrity_check` and
requires a known Blueballs migration history. Backups must be copied to a
different failure domain and encrypted by the deployment storage/KMS layer.

A snapshot is not continuous point-in-time recovery by itself. Deployments that
require PITR must additionally archive/replicate SQLite WAL or use an underlying
storage/database service that provides continuous recovery. Core Blueballs does
not pretend one PITR implementation can be universal across Durable Objects,
self-hosted SQLite and institution-managed database infrastructure.

## Restore procedure

1. Fence/stop the active writer.
2. Preserve the failed database/WAL files for investigation; do not overwrite
   the only evidence.
3. Select the newest backup/recovery point consistent with the approved RPO.
4. Validate the snapshot with `PRAGMA integrity_check` and banking schema
   version.
5. Restore to a **new path/volume**, not over a running database.
6. Start the exact compatible application commit in isolation.
7. Recompute representative ledger-derived balances and inspect pending provider
   / webhook / reconciliation state.
8. Confirm migrations, tenant identity and key state.
9. Route synthetic probes, then production traffic.
10. Retain the prior failed volume until reconciliation and incident review are
    complete.

The automated API recovery test exercises snapshot creation, integrity checking,
restore and exact-money preservation on every banking test run.

## Disaster-recovery drill

At least once per release candidate for a materially changed persistence/finality
layer, and at least quarterly for a deployed institution:

1. create a clean isolated environment;
2. restore a production-like encrypted backup or platform export;
3. start the candidate commit;
4. verify migration compatibility;
5. compare resource counts and ledger-derived balance totals to the source
   control totals;
6. inspect all non-terminal provider/webhook operations;
7. prove idempotent replay does not duplicate a transfer or provider job;
8. execute one new low-value/synthetic command after restore;
9. record measured RPO and RTO;
10. fail the operational review if either exceeds the institution's approved
    objective.

A DR exercise is evidence only when its source commit, backup/recovery point,
start/end times and validation results are retained.

## Secret rotation

### Provider payload/webhook encryption keyring

Blueballs stores a key ID with encrypted provider payloads and webhook signing
secrets. Rotation is therefore overlap-first:

1. add the new key to `BANK_PROVIDER_PAYLOAD_KEYS` while retaining all old keys;
2. change `BANK_PROVIDER_PAYLOAD_ACTIVE_KEY_ID` to the new key ID;
3. deploy and create a canary provider job/webhook target;
4. verify new ciphertext uses the new key ID;
5. allow all old queued/reconciliation jobs to become terminal or be explicitly
   re-encrypted under an approved maintenance procedure;
6. only then remove retired decryption keys.

Never delete an old key while a durable row still references its key ID.

### Provider gateway bearer token

Use an overlap window in the gateway: configure the gateway to accept old and new
tokens, switch `BANK_PROVIDER_GATEWAY_TOKEN` in Blueballs, verify traffic, then
retire the old token. If the provider/gateway cannot overlap credentials, treat
the rotation as a controlled maintenance change and preserve reconciliation for
ambiguous in-flight operations.

### Provider inbound HMAC secret

The private callback requires the normal operator/private network boundary plus
`BANK_PROVIDER_INBOUND_SECRET` HMAC evidence. Coordinate secret rotation between
the gateway and Blueballs. Pause inbound delivery or make the gateway retry
while the new secret is deployed; event IDs make retried settled evidence
idempotent.

### API/operator credentials

Issue replacement scoped credentials before revoking old ones. Do not widen
permissions as part of rotation. Operator root credentials live only in the
secret/IAM layer; no clear-text operator credential belongs in Git, logs or a
browser bundle.

## Incident priorities

When financial correctness is uncertain, prefer stopping mutation traffic to
continuing with ambiguous state. Preserve database/provider evidence, stop blind
retries, keep reconciliation cases open and resume only after one authoritative
funds position is established.

Operational availability is not allowed to override ledger, tenant-isolation or
provider-finality invariants.
