# Production Operations Runbook

Blueballs exposes explicit runtime health, readiness, reconciliation, recovery, rotation and release-evidence contracts for financial operation.

[`PRODUCTION-OPERATIONS.md`](PRODUCTION-OPERATIONS.md) defines the HA, RPO/RTO and recovery standard; [`SCALING.md`](SCALING.md) defines the authoritative-shard scale model.

## Runtime endpoints

The banking runtime exposes infrastructure endpoints outside the 181-operation product catalogue:

- `GET /v2/_health` — liveness, runtime mode, source commit and schema identity;
- `GET /v2/_ready` — dependency readiness;
- `GET /v2/_ops/metrics` — operator-authenticated aggregate operational state.

Route customer traffic only to a runtime with healthy readiness.

## Monitoring

Recommended production signals:

| Signal | Operational trigger |
| --- | --- |
| `_ready` | sustained non-2xx |
| provider `ambiguous` / `manual_review` | non-zero or increasing |
| open reconciliation cases | beyond institution SLA |
| oldest reconciliation age | beyond settlement/provider SLA |
| provider p95/max latency | above provider SLO |
| webhook backlog | sustained growth |
| failed financial commands | unexplained increase |
| idempotency replay rate | abnormal client retry pattern |
| source/tenant 429s | abuse or pacing issue |
| aggregate balances | unexpected discontinuity |
| source commit / schema | mismatch with intended release |

The metrics endpoint is designed for export into the institution's Prometheus/OpenTelemetry/logging stack.

## Reconciliation rule

External finality is evidence-driven. For ambiguous provider work:

1. identify the stable `job_id` and `provider_reference`;
2. query/reconcile through the provider adapter;
3. determine canonical provider/funds state;
4. apply the canonical outcome once;
5. verify ledger/resource state;
6. resolve the reconciliation case and retain command/provider/audit correlation.

Stable provider job identity prevents network ambiguity from turning into duplicate submission.

## Banking backup

Create a verified snapshot:

```bash
pnpm backup:banking -- --source /var/lib/blueballs/blueballs.sqlite \
  --destination /backups/blueballs-$(date -u +%Y%m%dT%H%M%SZ).sqlite
```

The backup path checkpoints WAL, creates a consistent SQLite image, runs integrity checks and verifies banking migration history/schema version.

Use storage-level encryption and place backup copies in a separate failure domain.

## Restore

Fence the target writer, then restore:

```bash
pnpm restore:banking -- --backup /backups/blueballs-....sqlite \
  --destination /var/lib/blueballs/blueballs.sqlite
```

The restore validates the source snapshot and restored copy before installing the target atomically.

Before resuming traffic:

1. boot the intended release;
2. require readiness success;
3. compare source commit and schema version;
4. reconcile aggregate balances with external providers;
5. inspect provider/webhook outboxes for work spanning the recovery point;
6. reconcile external finality;
7. retain restore/recovery evidence.

## RPO / RTO and DR

The reference operating standard targets:

- no intentional loss of acknowledged ledger/customer-money state;
- provider/webhook durable evidence with the same durability as the financial command that created it;
- RTO <= 30 minutes for a rehearsed, pre-provisioned banking topology.

Periodic snapshots are independent recovery points; committed-money RPO is provided by the institution's durable replication/PITR/storage layer.

A DR exercise should prove:

- primary writer fencing;
- infrastructure recreation from version-controlled configuration;
- secret rehydration;
- approved recovery-point restore;
- source/schema checks;
- provider/webhook reconciliation;
- external control-total agreement;
- measured RPO/RTO;
- readiness before traffic resumption.

## Cloudflare Durable Objects

The Cloudflare banking composition uses SQLite-backed Durable Objects and alarms for durable provider/webhook work. Worker tests deliberately evict the object and reconstruct representative financial families from durable state.

Cloudflare deployments can layer export/backup and incident-recovery policy around the same banking contracts.

## High availability and scale

The banking core uses one authoritative writer per shard. Do not place independent writable SQLite replicas behind a load balancer.

Reference HA pattern:

- one authoritative active writer;
- replicated/fenced standby environment;
- readiness gating;
- storage durability meeting the financial RPO;
- explicit failover fencing;
- provider/webhook pumps active only on the authoritative writer;
- reconciliation after failover.

Scale-out uses institution/tenant shards with principal routing. Cross-shard money movement uses explicit reserve/settle/credit orchestration and stable operation IDs.

See [`SCALING.md`](SCALING.md).

## Secret and key rotation

Treat these as deployment secret-manager values:

- production bootstrap/recovery credential;
- trusted-human actor assertion secret;
- operator credential/hash source;
- provider gateway token;
- provider payload/webhook encryption keys;
- provider inbound HMAC secret;
- deployment adapter provider/venue credentials.

### Provider payload / webhook keys

Use `BANK_PROVIDER_PAYLOAD_KEYS` plus `BANK_PROVIDER_PAYLOAD_ACTIVE_KEY_ID`. Add the new key, switch the active ID, deploy, and retain old keys until no durable provider/webhook row references them.

### Provider inbound HMAC

Rotate the gateway and banking runtime as one versioned rollout so signing and verification material overlap safely.

### Tenant/operator credentials

Rotate tenant keys through scoped issuance/revocation. Production credential recovery targets the existing tenant explicitly. Rotate operator credentials through deployment secret management and controlled runtime rollout.

See [`IAM.md`](IAM.md) and [`PRODUCTION-OPERATIONS.md`](PRODUCTION-OPERATIONS.md).

## Load and chaos

Deterministic restart/chaos:

```bash
pnpm stress:chaos
```

Self-contained release load proof:

```bash
pnpm stress:release
```

Custom soak profile:

```bash
LOAD_MODE=both LOAD_DURATION_SECONDS=300 LOAD_CONCURRENCY=25 \
BANK_API_KEY=... BANK_ACCOUNT_ID=... pnpm stress:load
```

See [`LOAD-CHAOS.md`](LOAD-CHAOS.md).

## Release assurance

Full release verification:

```bash
pnpm install --frozen-lockfile
pnpm verify:release
```

The release profile covers:

- build/types/contracts;
- 181-operation banking lifecycle proof;
- tenant isolation and exact-money invariants;
- provider/webhook finality and reconciliation;
- Cloudflare runtime/eviction;
- FX packages and production runtime adapter contract;
- Foundry unit/fuzz/invariants;
- tracked-secret and production dependency checks;
- CycloneDX inventory;
- restart/chaos;
- disposable banking + FX load proof;
- reference-container vulnerability scan;
- clean-checkout integrity.

Retain `artifacts/verification-report.json`, API operation coverage, load report, dependency inventory and release/container digests with the release.

## Deployment sequence

1. select one clean release candidate;
2. run `pnpm verify:release`;
3. archive generated release evidence;
4. deploy the unchanged artifact to preview/staging;
5. exercise banking/FX/provider reconciliation smoke flows;
6. promote the same artifact;
7. monitor readiness, balances, provider finality and reconciliation queues.

See [`../RELEASE.md`](../RELEASE.md) and [`../PRODUCTION-HARDENING.md`](../PRODUCTION-HARDENING.md).
