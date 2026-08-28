# Deployment identity and parity

Blueballs deploys the banking API, FX node and site as three Cloudflare Workers.
A deployment is complete only when all three report the same Git commit.

## Guarded command

```bash
pnpm deploy:cloudflare
```

The deploy command refuses to run unless:

- Node matches `.node-version` exactly;
- pnpm matches the version pinned in `package.json` exactly;
- the worktree is clean;
- `HEAD` equals `origin/main`;
- the FX Worker has its required `FX_API_KEY` Cloudflare secret;
- the full local release gate passes.

It deploys banking API, FX and site in that order and injects the exact commit as
`BLUEBALLS_GIT_SHA`. A complete deployment then polls live health and fails
unless all three Workers report that commit. Individual deploy commands carry
the same clean-tree and published-commit guard.

## Proof after deployment

```bash
curl -fsS https://blueballs.tech/api/health
curl -fsS https://blueballs.tech/v2
curl -fsS https://blueballs.tech/fx-health
```

`/api/health` returns `deployment_consistent: true` only when the site, banking
API and FX node report the same source commit. Every response also carries
`x-blueballs-source-commit`.

Run the tenant-isolation smoke probes after the version check. Never use a
production customer's identifiers or repeat a disclosed exploit against live
data; create two disposable sandbox tenants and prove only that cross-tenant
reads return 404.

Record the Worker version IDs, commit, deployment time and smoke-test result in
the release notes. Wrangler authentication is an operator prerequisite, not a
reason to bypass these checks.
