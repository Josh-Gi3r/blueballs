# Release process

Blueballs releases are prepared and verified locally.

## Requirements

- the release commit is on `main` and the working tree is clean;
- package versions and `CHANGELOG.md` agree;
- generated OpenAPI files are current;
- no credentials, customer data or local databases are present;
- `pnpm verify` passes;
- product screenshots and public documentation match the release;
- production boundaries and required adapters are stated clearly.

## Verify

```bash
pnpm install --frozen-lockfile
pnpm verify
```

Build the reference images on a machine with Docker:

```bash
docker build -f apps/fx-node/Dockerfile -t blueballs-fx:0.1.0 .
docker build -f Dockerfile.reference -t blueballs-reference:0.1.0 .
docker compose -f compose.reference.yml config >/dev/null
```

Generate optional distribution artifacts:

```bash
make -C packages/fx-contracts abi
node scripts/dependency-inventory.mjs artifacts/blueballs-sbom.cdx.json
pnpm --dir packages/fx-sdk pack:check
```

The controlled Anvil procedure is included in `pnpm verify`. It exercises the
Solidity contracts on a local JSON-RPC node; it is not a production-network or
external-audit claim.

## Tag

Use an annotated signed tag when signing is available:

```bash
git tag -s v0.1.0 -m "Blueballs v0.1.0"
git push origin v0.1.0
```

If signed tags are unavailable, state that plainly in the release notes.

## Release contents

A release may include:

- the source revision and changelog;
- banking and FX OpenAPI contracts;
- the packed FX SDK;
- exported contract ABIs and checksums;
- a CycloneDX dependency inventory;
- container image references;
- deployment and production-checklist notes.

Publishing packages, container images or a GitHub Release is a separate
maintainer decision after the artifacts have been reviewed.

## After publication

- confirm the tag resolves to the intended commit;
- verify published checksums and package contents;
- document breaking changes, migrations and required adapters;
- keep previous releases available for comparison;
- open the next `Unreleased` changelog section.

A Blueballs reference release identifies tested source; it does not imply
regulatory approval, independent security review or production suitability for
a particular institution.
