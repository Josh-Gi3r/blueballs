# Testing and Verification

Blueballs keeps its verification commands in the repository so contributors can
run the same checks locally. A focused test is useful during development; a
release candidate must pass the complete suite.

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
- all 181 banking routes against access, request-body, response-status and
  OpenAPI coverage;
- ESLint correctness rules across tracked JavaScript;
- OpenAPI lint and generated TypeScript declaration compilation;
- SDK tarball contents;
- site build, routes, public copy, provider data and product screenshots;
- Foundry format, build, unit, fuzz, invariant and controlled-EVM checks;
- Docker Compose configuration validity.

An actual Docker image build is a release-machine gate because it needs a
running daemon. It is not implied by Compose validation.

## Focused development commands

```bash
pnpm build
pnpm lint
pnpm test:api
pnpm test:workers
pnpm test:fx
pnpm build:openapi
pnpm lint:openapi
node scripts/check-catalogue.mjs
node scripts/check-doc-assets.mjs
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

## Release verification

1. Run the complete suite from a clean working tree.
2. Confirm generated files are in sync with their sources.
3. Do not treat screenshots, a successful bundle or an OpenAPI file as proof of
   runtime behaviour on its own.
4. A new route must have an access class, operation-accurate request contract,
   response status, negative tests and a builder-facing example where it forms
   part of a product journey.

The tagged release procedure and artefact list live in [`RELEASE.md`](RELEASE.md).
