# Production operations runbook

Blueballs core targets production-grade financial operation. This runbook covers
runtime health, dependency readiness, monitoring, backup/restore, recovery,
secrets and release evidence. Institution-specific licences, vendors, SRE tooling
and jurisdictional procedures remain deployment-owned, but they plug into these
core operational contracts.

## Runtime endpoints

The banking runtime exposes three infrastructure endpoints outside the 181-operation
product catalogue:

- `GET /v2/_health` — public liveness. It proves the process/Worker is serving and
  reports runtime mode, source commit and banking schema version.
- `GET /v2/_ready` — public readiness. In production it fails `503` unless the
  database schema is current and the provider transport, provider-payload
  encryption and signed provider-inbound authentication dependencies are
  configured.
- `GET /v2/_ops/metrics` — operator-authenticated aggregate operational state.
  It reports resource counts, aggregate account/wallet balances by currency,
  audit failures/replays, provider-outbox state/latency, webhook backlog and
  reconciliation backlog. It never returns customer names, provider payloads or
  credentials.

Load balancers should use `_health` for liveness and `_ready` for readiness.
Do not route customer traffic to a runtime returning non-2xx readiness.

## Minimum monitoring

A production deployment should collect and alert on at least:

| Signal | Alert condition |
| --- | --- |
| `_ready` | Any sustained 503 |
| provider `ambiguous` / `manual_review` | Non-zero or increasing |
| open reconciliation cases | Non-zero beyond institution SLA |
| oldest open reconciliation age | Above settlement/provider SLA |
| provider attempt p95/max latency | Above provider SLO |
| webhook failed/pending backlog | Sustained growth |
| failed financial commands | Any unexplained increase |
| idempotency replays | Sudden increase, which can indicate client retry loops |
| source/tenant 429s | Sustained abuse or incorrect client pacing |
| aggregate balances | Unexpected discontinuity; reconcile against external providers |
| source commit | Runtime differs from intended release SHA |
| banking schema version | Runtime differs from release migration version |

The metrics endpoint is an operational API, not a replacement for Prometheus,
OpenTelemetry or the deployment's logging/alerting platform. Export these fields
into the institution's monitoring system.

## Reconciliation operating rule

Never infer external financial finality from transport success or failure.
Provider jobs with ambiguous evidence remain in reconciliation. Operators should:

1. identify the stable provider `job_id` and `provider_reference`;
2. query the provider through the adapter's reconcile phase;
3. determine canonical provider/funds state;
4. apply the canonical outcome once;
5. verify ledger/resource state and resolve the reconciliation case;
6. retain the command/provider/audit correlation for incident evidence.

Do not manually refund a transfer merely because a provider request timed out.

## Node/SQLite backup

`VACUUM INTO` is used to create a transactionally consistent SQLite snapshot,
including when the source runtime uses WAL mode.

```bash
pnpm backup:banking -- --db /var/lib/blueballs/blueballs.sqlite \
  --out /backups/blueballs/blueballs-$(date -u +%Y%m%dT%H%M%SZ).sqlite
```

The command:

1. checkpoints WAL passively;
2. creates a separate consistent SQLite image;
3. runs `PRAGMA integrity_check` on the snapshot;
4. verifies Blueballs banking migration history and current schema version;
5. deletes the snapshot if verification fails.

Backups must be copied to a separate failure domain and encrypted by the
storage/backup platform. Provider outbox field encryption does not replace disk
or backup encryption.

### Backup policy

A reasonable default for a small institution deployment is:

- verified database snapshot every 15 minutes;
- daily immutable copy retained 35 days;
- monthly copy retained according to jurisdiction/record-retention policy;
- off-site or cross-region copy;
- automated alert on missed/failed backup;
- restore drill at least monthly before 1.0 certification, then on the operating
  schedule chosen by the institution.

This gives an **RPO target of 15 minutes for snapshot-only Node deployments**.
Institutions needing a smaller RPO must add storage-level continuous replication
or WAL-aware backup/PITR appropriate to their infrastructure. Blueballs does not
pretend periodic snapshots provide zero-data-loss recovery.

## Restore

Fence or stop the target banking runtime before replacing its database. Restoring
under an active writer is prohibited.

```bash
pnpm restore:banking -- --backup /backups/blueballs/blueballs-....sqlite \
  --db /var/lib/blueballs/blueballs.sqlite --force
```

The restore command validates the backup first, copies to a temporary path,
validates that copy again and atomically renames it into place. `--force` exists
only for an explicitly fenced/stopped target.

After restore:

1. boot the exact intended Blueballs release;
2. require `_ready` to return 200;
3. compare release SHA and schema version;
4. reconcile aggregate balances with external bank/custody/payment providers;
5. inspect provider and webhook outboxes for work whose external finality may
   have occurred after the restored snapshot;
6. reconcile every such ambiguous external operation before resuming normal
   processing;
7. retain restore time, source backup, operator and verification evidence.

Because external side effects cannot be rolled back with a database snapshot,
post-restore reconciliation is mandatory.

## RTO / DR targets

The reference operational targets for a small production deployment are:

- **RPO:** <=15 minutes with the documented snapshot policy; lower only when the
  deployment supplies continuous replicated/PITR storage.
- **RTO:** <=60 minutes for a rehearsed Node restore into pre-provisioned
  infrastructure.

These are reference objectives, not guarantees. A deploying institution must set
and test targets appropriate to its volume, regulatory obligations and provider
SLAs.

A disaster-recovery exercise should prove:

- primary banking runtime is fenced;
- infrastructure can be recreated from version-controlled configuration;
- secrets can be rehydrated from the deployment secret manager;
- latest verified snapshot restores successfully;
- source commit/schema checks pass;
- provider/webhook ambiguous work is reconciled;
- customer-visible balances match external control totals;
- customer traffic resumes only after readiness and reconciliation approval.

## Cloudflare Durable Object deployments

The Cloudflare reference keeps banking state in a SQLite-backed Durable Object
and uses Durable Object alarms for durable webhook/provider work. Worker runtime
tests deliberately evict the object and prove core financial state survives
in-memory loss.

Durable Object deployments still require a deployment-owned backup/export and
regional/incident-recovery policy. Do not assume object durability eliminates the
need for recovery evidence or external-provider reconciliation.

## High availability and scale

### Current correctness model

The banking runtime deliberately serializes command units while one mutable
SQLite-backed storage view owns the institution state. This provides simple,
strong financial ordering and prevents dirty reads/double spend.

### Node reference HA

Do **not** run two independent writable SQLite nodes behind a load balancer. That
would create split-brain financial state.

The supported reference pattern is:

- one active writer;
- one or more externally replicated/fenced standby environments;
- health/readiness gating;
- durable encrypted backup/replication outside the primary host;
- explicit failover fencing so only one writer can accept commands;
- provider/webhook reconciliation after failover.

For higher write throughput, move to a storage/runtime topology that preserves
serialized ownership per institution or shard. Never add horizontal writers by
weakening ledger/idempotency invariants.

### Sharding direction

The natural scale-out boundary is institution/tenant ownership: each shard owns
its ledger, resource state, idempotency, audit and outboxes. A global API-key/
routing directory may route authenticated requests to the correct owner, but a
financial command must execute entirely within one authoritative shard.
Cross-shard financial workflows require explicit settlement messages/outboxes,
not distributed mutation of two SQLite caches.

## Secret and key rotation

At minimum treat these as secret-manager values:

- production bootstrap credential;
- operator credential/hash source;
- provider gateway token;
- provider payload-encryption keys;
- provider inbound HMAC secret;
- webhook signing secrets;
- real vendor credentials behind the deployment-owned provider gateway.

### Provider payload-encryption keys

Use `BANK_PROVIDER_PAYLOAD_KEYS` with an active key ID. Add the new key, make it
active, deploy, and retain the old key until no durable provider job references
its `kid`. Removing an old key too early turns queued/reconciliation work
undecryptable.

### Provider inbound HMAC secret

Rotate through the provider gateway and Blueballs deployment as a coordinated
change. During a rotation window, use infrastructure/version rollout controls so
a gateway never signs with a secret the active banking runtime cannot verify.
Do not reuse the generic operator key as the provider-signing secret.

### API/operator credentials

Issue/revoke secondary tenant API keys through scoped permissions. Operator
credential rotation is deployment-owned; rotate it in the secret manager and
restart/roll the runtime before retiring the previous deployment credential.

## Security release checks

The hosted Production Gate performs:

- tracked high-signal secret scanning;
- production dependency advisory audit at high/critical severity;
- CodeQL JavaScript/TypeScript analysis;
- banking/Worker/FX/contracts/container gates.

An independent application/smart-contract security review is still required
before a 1.0 production certification claim. Self-tests are not an independent
audit.

## Release evidence

For every release retain:

- exact commit SHA;
- green required hosted `Production gate` for that SHA;
- clean-checkout `pnpm verify` output;
- 181-operation coverage artifact;
- OpenAPI and SDK generation proof;
- Foundry fuzz/invariant result;
- Worker eviction/runtime result;
- container image digest and Compose validation;
- dependency inventory/SBOM;
- security gate result;
- banking schema version;
- backup/restore drill evidence for the release line;
- known adapter/external-service limitations.

A release is not production-certified because the website loads or a static spec
exists. The release evidence must prove the financial/runtime contracts.
