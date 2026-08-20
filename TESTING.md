# Testing and Verification

Blueballs treats tests and generated contracts as public product evidence. A
green scoped test is useful during development; a release claim requires the
complete gate on one named commit.

## Toolchain

- Node.js 24.15 or newer within the pinned 24.x line
- pnpm from the root `packageManager` field
- Foundry for Solidity tests and controlled EVM proof
- Docker with Compose for image and stack verification
- Wrangler for Cloudflare bundle and Durable Object checks

Install exactly from the lockfile:

```bash
pnpm install --frozen-lockfile
```

## Complete repository gate

```bash
pnpm verify
```

The root gate checks:

- banking HTTP workflows, tenant-negative cases, exact money, idempotency,
  double-entry rollback and the executable banking quickstart;
- all nine canonical FX package/node suites;
- Durable Object transaction rollback and persistence across restart;
- all 174 banking routes against access, request-body, response-status and
  OpenAPI coverage;
- OpenAPI lint and generated TypeScript declaration compilation;
- SDK tarball contents;
- site build, route/copy/provider provenance and visual-evidence manifests;
- Foundry format, build, unit, fuzz, invariant and controlled-EVM checks;
- Docker Compose configuration validity.

An actual Docker image build is a release-machine gate because it needs a
running daemon. It is not implied by Compose validation.

## Focused development commands

```bash
pnpm build
pnpm test:api
pnpm test:workers
pnpm test:fx
pnpm build:openapi
pnpm lint:openapi
node scripts/check-catalogue.mjs
node scripts/check-doc-evidence.mjs
```

Use `pnpm run` to see the exact commands available at the current commit. Before
claiming a focused pass, state which surface was checked.

For Solidity only:

```bash
cd packages/fx-contracts
pnpm verify
```

For a manual API journey, start `pnpm dev`, then run:

```bash
node examples/banking-quickstart.mjs http://localhost:5290
```

## Evidence rules

1. Record `git rev-parse HEAD` in the same worktree that runs the gate.
2. Require a clean working tree for a release candidate.
3. Attribute test counts and generated artefacts to that exact commit.
4. Do not treat browser screenshots, a successful bundle or an OpenAPI file as
   proof of runtime behaviour on its own.
5. A new route must have an access class, operation-accurate request contract,
   response status, negative tests and a builder-facing example where it forms
   part of a product journey.

The tagged release procedure and artefact list live in [`RELEASE.md`](RELEASE.md).
